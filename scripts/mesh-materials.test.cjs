const assert = require('node:assert/strict');
const { test } = require('node:test');

async function dependencies() {
    const three = await import('three');
    const { instantiateMesh } = await import('../webview/src/utils/mesh-materials.ts');
    return { ...three, instantiateMesh };
}

test('cached geometry gets the current URDF material without contaminating other visuals', async () => {
    const { Mesh, BoxGeometry, MeshPhongMaterial, instantiateMesh } = await dependencies();
    const template = new Mesh(new BoxGeometry(), new MeshPhongMaterial());
    const red = new MeshPhongMaterial({ color: 'red', opacity: 0.4, transparent: true });
    const blue = new MeshPhongMaterial({ color: 'blue' });
    const first = instantiateMesh(template, red, true);
    const second = instantiateMesh(template, blue, true);
    assert.equal(first.material.color.getHexString(), 'ff0000');
    assert.equal(first.material.opacity, 0.4);
    assert.equal(first.material.transparent, true);
    assert.equal(second.material.color.getHexString(), '0000ff');
    assert.equal(first.geometry, second.geometry);
    first.material.color.set('green');
    assert.equal(second.material.color.getHexString(), '0000ff');
    assert.equal(red.color.getHexString(), 'ff0000');
    assert.equal(template.material.color.getHexString(), 'ffffff');
    assert.equal(instantiateMesh(template, red, true).material.color.getHexString(), 'ff0000');
});

test('embedded materials and textures survive instancing and stay isolated from visual changes', async () => {
    const { Group, Mesh, BoxGeometry, MeshStandardMaterial, MeshPhongMaterial, Texture, instantiateMesh } = await dependencies();
    const texture = new Texture();
    const embedded = new MeshStandardMaterial({ color: 'gold', map: texture });
    const template = new Group();
    template.add(new Mesh(new BoxGeometry(), [embedded, embedded.clone()]));
    const urdf = new MeshPhongMaterial({ color: 'red' });
    const first = instantiateMesh(template, urdf, false).children[0];
    const second = instantiateMesh(template, urdf, false).children[0];
    assert.equal(first.material[0].map, texture);
    assert.equal(first.material[0].color.getHexString(), 'ffd700');
    assert.notEqual(first.material[0], embedded);
    assert.notEqual(first.material[1], second.material[1]);
    first.material[0].opacity = 0.2;
    assert.equal(second.material[0].opacity, 1);
    assert.equal(embedded.opacity, 1);
});


test('OBJ vertex colors keep their loader material instead of being overwritten by URDF color', async () => {
    const { Mesh, BufferGeometry, Float32BufferAttribute, MeshPhongMaterial, instantiateMesh } = await dependencies();
    const geometry = new BufferGeometry();
    geometry.setAttribute('color', new Float32BufferAttribute([0, 1, 0], 3));
    const embedded = new MeshPhongMaterial({ vertexColors: true });
    const template = new Mesh(geometry, embedded);
    const instance = instantiateMesh(template, new MeshPhongMaterial({ color: 'red' }), true);
    assert.equal(instance.material.vertexColors, true);
    assert.equal(instance.material.color.getHexString(), 'ffffff');
    assert.notEqual(instance.material, embedded);
});
