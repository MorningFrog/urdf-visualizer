// Optional browser integration checks. Supply Playwright through NODE_PATH;
// it is intentionally not a shipping or locked project dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const bridgeSource = `
export { Vector3, REVISION } from 'three';
export * from '/src/stores/scene-store.ts';
export { urdfStore } from '/src/stores/urdf-store.ts';
export { vscodeSettings } from '/src/stores/vscode-settings.ts';
export { visualSettings } from '/src/stores/visual-settings.ts';
export { measureStore } from '/src/stores/measure-store.ts';
export { measureSettings } from '/src/stores/measure-settings.ts';
`;

async function main() {
    const { createServer } = await import(pathToFileURL(path.join(root, 'webview/node_modules/vite/dist/node/index.js')));
    // This bridge exists only in this test server, never in the production build.
    const server = await createServer({
        root: path.join(root, 'webview'),
        server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
        plugins: [{
            name: 'urdf-browser-test-bridge',
            resolveId(id) { if (id === '/__test_bridge') return '\0urdf-test-bridge'; },
            load(id) { if (id === '\0urdf-test-bridge') return bridgeSource; },
        }],
    });
    let browser;
    try {
        await server.listen();
        browser = await chromium.launch({
            headless: true,
            executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
            args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        const requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(() => {
            let state = {};
            window.vscodeMessages = [];
            window.measurementText = [];
            window.acquireVsCodeApi = () => ({
                postMessage: message => window.vscodeMessages.push(message),
                getState: () => state,
                setState: value => { state = value; },
            });
            const fillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (...args) {
                window.measurementText.push(String(args[0]));
                return fillText.apply(this, args);
            };
        });
        await page.route('https://models.test/**', async route => {
            const name = new URL(route.request().url()).pathname.slice(1);
            requests.push(name);
            const filename = name === 'texture.glb' && process.env.URDF_VISUALIZER_FIXTURES
                ? path.join(process.env.URDF_VISUALIZER_FIXTURES, 'glb_texture/arml7.glb')
                : path.join(__dirname, 'fixtures', path.basename(name));
            await route.fulfill({ body: fs.readFileSync(filename), headers: { 'access-control-allow-origin': '*' } });
        });
        await page.goto(server.resolvedUrls.local[0]);
        await page.waitForFunction(() => window.vscodeMessages.some(m => m.type === 'webviewReady'), null, { polling: 100 });
        await page.evaluate(async () => { window.bridge = await import('/__test_bridge'); });
        const i18n = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8'));
        await page.evaluate(i18n => window.postMessage({
            type: 'init', urdfText: '<robot name="initial"><link name="base_link"/></robot>',
            filename: 'initial.urdf', workingPath: '', uriPrefix: 'models.test', packages: {}, i18n,
        }, '*'), i18n);
        let serial = 0;
        async function load(body, meshCount) {
            const name = `browser_${++serial}`;
            await page.evaluate(({ name, body }) => window.postMessage({
                type: 'urdf', urdfText: `<robot name="${name}">${body}</robot>`,
                filename: `${name}.urdf`, workingPath: '', reset_camera: true,
            }, '*'), { name, body });
            await page.waitForFunction(({ name, meshCount }) => {
                const robot = window.bridge.urdfStore.robot;
                let count = 0;
                robot?.traverse(object => { if (object.isMesh) count++; });
                return robot?.robotName === name && count >= meshCount;
            }, { name, meshCount }, { polling: 100 });
            await page.waitForTimeout(200);
        }
        const visual = (name, mesh, color, opacity = 1) => `<visual name="${name}"><geometry><mesh filename="${mesh}"/></geometry><material name="${name}"><color rgba="${color} ${opacity}"/></material></visual>`;
        const stlBody = `<link name="base_link">${visual('red', 'triangle.stl', '1 0 0', 0.4)}${visual('blue', 'triangle.stl', '0 0 1')}</link>`;
        async function material(name) {
            return page.evaluate(name => {
                let result;
                window.bridge.urdfStore.robot.getObjectByName(name).traverse(object => {
                    if (!object.isMesh) return;
                    const m = Array.isArray(object.material) ? object.material[0] : object.material;
                    result = { color: m.color.getHexString(), opacity: m.opacity, texture: !!m.map, vertexColors: m.vertexColors };
                });
                return result;
            }, name);
        }
        await load(stlBody, 2);
        assert.equal((await material('red')).color, 'ff0000');
        assert.equal((await material('red')).opacity, 0.4);
        assert.equal((await material('blue')).color, '0000ff');
        let count = requests.length;
        await load(stlBody, 2);
        assert.equal(requests.length, count, 'cache hit should not request meshes');
        await page.evaluate(() => { window.bridge.vscodeSettings.cacheMesh = false; });
        await load(stlBody, 2);
        assert(requests.length > count, 'cache disabled should load resources');
        await page.evaluate(() => { window.bridge.vscodeSettings.cacheMesh = true; });
        await load(stlBody, 2);
        count = requests.length;
        await load(stlBody, 2);
        assert.equal(requests.length, count);
        assert.equal((await material('red')).opacity, 0.4);
        assert.equal((await material('blue')).color, '0000ff');
        await load(`<link name="base_link">${visual('obj', 'triangle.obj', '1 0 0')}${visual('dae', 'triangle.dae', '1 0 0')}</link>`, 2);
        assert.equal((await material('obj')).vertexColors, true);
        assert.equal((await material('obj')).color, 'ffffff');
        assert.equal((await material('dae')).color, '00ff00');
        if (process.env.URDF_VISUALIZER_FIXTURES) {
            await load(`<link name="base_link">${visual('glb', 'texture.glb', '1 0 0')}</link>`, 1);
            const embedded = await material('glb');
            assert(embedded.texture, 'GLB embedded texture survives');
            assert.notEqual(embedded.color, 'ff0000');
        }
        console.log('STL, OBJ, DAE, optional GLB and cache/material checks passed');

        // A known plane provides real raycast intersections for numeric measurements.
        await load('<link name="base_link"><visual><origin xyz="0 0 -0.025"/><geometry><box size="4 4 0.05"/></geometry></visual></link>', 1);
        await page.evaluate(() => {
            window.bridge.measureSettings.precision = 5;
            const { camera, controls } = window.bridge;
            camera.up.set(0, 1, 0);
            camera.position.set(0, 0, 6);
            controls.target.set(0, 0, 0);
            controls.update();
            camera.updateMatrixWorld();
        });
        async function project(point) {
            return page.evaluate(point => {
                const { Vector3, camera, renderer } = window.bridge;
                const p = new Vector3(...point).project(camera);
                const rect = renderer.domElement.getBoundingClientRect();
                return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
            }, point);
        }
        async function select(point) {
            const p = await project(point);
            await page.mouse.click(p.x, p.y);
            await page.waitForTimeout(550); // separate real clicks from the double-click gesture
        }
        const buttons = page.locator('button.du-btn-circle.du-btn-primary');
        async function start(index) {
            await page.locator('button.du-btn-circle.du-btn-warning').click();
            await page.evaluate(() => { window.measurementText = []; });
            await buttons.nth(index).click();
        }
        async function expectLabel(value, unit) {
            // Mouse events use pixel coordinates, so allow 0.5% projection error.
            console.log('Checking measurement', value, unit, await page.evaluate(() => window.measurementText.slice(-5)));
            await page.waitForFunction(({ value, unit }) => window.measurementText.some(text => {
                const number = Number.parseFloat(text);
                return text.endsWith(` ${unit}`) && Math.abs(number - value) < Math.max(0.005, Math.abs(value) * 0.005);
            }), { value, unit }, { polling: 100, timeout: 5000 });
        }
        const points = [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0]];
        await start(1);
        await select(points[0]); await select(points[1]);
        await page.keyboard.press('Enter');
        await expectLabel(1, 'm');
        await page.evaluate(() => { window.bridge.visualSettings.lengthUnit = 'centimeter'; });
        await expectLabel(100, 'cm');
        await page.evaluate(() => { window.bridge.visualSettings.lengthUnit = 'meter'; });
        await start(2);
        for (const point of points) await select(point);
        await expectLabel(90, '°');
        await page.evaluate(() => { window.bridge.visualSettings.angleUnit = 'radian'; });
        await expectLabel(Math.PI / 2, 'rad');
        await start(3);
        for (const point of points) await select(point);
        await page.keyboard.press('Enter');
        await expectLabel(0.5, 'm^2');
        await page.evaluate(() => { window.bridge.visualSettings.lengthUnit = 'centimeter'; });
        await expectLabel(5000, 'cm^2');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.bridge.measureStore.mode === 'none', null, { polling: 100 });
        assert.equal(await page.evaluate(() => {
            let count = 0;
            window.bridge.scene.traverse(object => { if (object.userData.__isMeasureOverlay) count++; });
            return count;
        }), 0, 'cancel removes measurement objects');
        console.log('Raycast distance/angle/area, units and cleanup passed');

        await load('<link name="base_link"/><link name="arm"><visual><origin xyz="0.5 0 0"/><geometry><box size="1 0.2 0.2"/></geometry></visual></link><joint name="test_joint" type="revolute"><parent link="base_link"/><child link="arm"/><axis xyz="0 0 1"/><limit lower="-3.14" upper="3.14" effort="1" velocity="1"/></joint>', 1);
        await page.locator('.du-collapse > input.peer').first().check();
        const jointRow = page.locator('li').filter({ hasText: 'test_joint' }).filter({ has: page.locator('input[type=range]') }).last();
        const slider = jointRow.locator('input[type=range]');
        await slider.fill('0.4');
        assert(Math.abs(await page.evaluate(() => window.bridge.urdfStore.jointValues.test_joint) - 0.4) < 0.001);
        await slider.fill('0');
        await page.evaluate(() => {
            const { camera, controls } = window.bridge;
            camera.up.set(0, 1, 0); camera.position.set(0, 0, 6);
            controls.target.set(0, 0, 0); controls.update(); camera.updateMatrixWorld();
        });
        const grab = await project([0.75, 0, 0.1]);
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.mouse.move(grab.x, grab.y - 80, { steps: 12 });
        await page.mouse.up();
        assert(Math.abs(await page.evaluate(() => window.bridge.urdfStore.jointValues.test_joint)) > 0.1, 'mouse drag changes joint');
        const cameraBefore = await page.evaluate(() => window.bridge.camera.position.toArray());
        await page.mouse.move(1100, 850); await page.mouse.down();
        await page.mouse.move(1200, 850, { steps: 10 }); await page.mouse.up();
        assert.notDeepEqual(await page.evaluate(() => window.bridge.camera.position.toArray()), cameraBefore, 'orbit gesture moves camera');
        const zoomBefore = await page.evaluate(() => window.bridge.camera.position.distanceTo(window.bridge.controls.target));
        await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
        assert(await page.evaluate(() => window.bridge.camera.position.distanceTo(window.bridge.controls.target)) > zoomBefore, 'wheel zooms out');
        for (const title of ['Show Visual', 'Show Collision', 'Show World Frame', 'Show Joint Frames', 'Show Link Frames']) {
            const input = page.locator('label').filter({ has: page.locator(`[title="${title}"]`) }).locator('input[type=checkbox]');
            const before = await input.isChecked();
            await input.setChecked(!before); assert.equal(await input.isChecked(), !before);
            await input.setChecked(before);
        }
        await page.locator('.du-collapse:has(select option[value="millimeter"]) > input.peer').check();
        const lengthSelect = page.locator('select').filter({ has: page.locator('option[value="millimeter"]') });
        await lengthSelect.selectOption('millimeter');
        assert.equal(await page.evaluate(() => window.bridge.visualSettings.lengthUnit), 'millimeter');
        const angleSelect = page.locator('select').filter({ has: page.locator('option[value="degree"]') });
        await angleSelect.selectOption('degree');
        assert.equal(await page.evaluate(() => window.bridge.visualSettings.angleUnit), 'degree');
        await page.getByTitle(i18n['webview.settings.measurement.precision.placeholder'], { exact: true }).fill('3');
        assert.equal(Number(await page.evaluate(() => window.bridge.measureSettings.precision)), 3);
        await page.locator('.du-collapse:has(select option[value="millimeter"]) > input.peer').uncheck();
        await buttons.first().hover();
        await page.waitForFunction(() => [...document.querySelectorAll('.v-popper__popper')].some(p => p.getAttribute('aria-hidden') === 'false'), null, { polling: 100 });
        console.log('Joint slider/drag, orbit/zoom, display/frame controls and tooltip passed');
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.vscodeMessages.filter(m => m.type === 'error')), []);
        assert.equal(await page.evaluate(() => window.bridge.REVISION), '186');
        assert(await page.evaluate(() => window.bridge.camera.position.constructor === window.bridge.Vector3), 'scene and bridge share Three.js');
        console.log('Settings panel and shared Three.js revision 186 passed');
    } finally {
        await browser?.close();
        await server.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
