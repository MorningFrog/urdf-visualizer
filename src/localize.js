"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localize = exports.localizeInstance = exports.Localize = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const vscode_1 = require("vscode");
class Localize {
    bundle = this.resolveLanguagePack();
    // @ts-ignore
    options;
    localize(key, ...args) {
        const message = this.bundle[key] || key;
        return this.format(message, args);
    }
    init() {
        try {
            this.options = {
                ...this.options,
                ...JSON.parse(process.env.VSCODE_NLS_CONFIG || "{}"),
            };
        }
        catch (err) {
            throw err;
        }
    }
    format(message, args = []) {
        return args.length
            ? message.replace(/\{(\d+)\}/g, (match, rest) => args[rest[0]] || match)
            : message;
    }
    resolveLanguagePack() {
        this.init();
        const languageFormat = "package.nls{0}.json";
        const defaultLanguage = languageFormat.replace("{0}", "");
        // @ts-ignore
        const rootPath = vscode_1.extensions.getExtension("morningfrog.urdf-visualizer").extensionPath;
        const resolvedLanguage = this.recurseCandidates(rootPath, languageFormat, this.options.locale);
        const languageFilePath = (0, path_1.resolve)(rootPath, resolvedLanguage);
        try {
            const defaultLanguageBundle = JSON.parse(resolvedLanguage !== defaultLanguage
                ? (0, fs_extra_1.readFileSync)((0, path_1.resolve)(rootPath, defaultLanguage), "utf-8")
                : "{}");
            const resolvedLanguageBundle = JSON.parse((0, fs_extra_1.readFileSync)(languageFilePath, "utf-8"));
            return { ...defaultLanguageBundle, ...resolvedLanguageBundle };
        }
        catch (err) {
            throw err;
        }
    }
    recurseCandidates(rootPath, format, candidate) {
        const filename = format.replace("{0}", `.${candidate}`);
        const filepath = (0, path_1.resolve)(rootPath, filename);
        if ((0, fs_extra_1.existsSync)(filepath)) {
            return filename;
        }
        if (candidate.split("-")[0] !== candidate) {
            return this.recurseCandidates(rootPath, format, candidate.split("-")[0]);
        }
        return format.replace("{0}", "");
    }
}
exports.Localize = Localize;
exports.localizeInstance = new Localize();
exports.localize = exports.localizeInstance.localize.bind(exports.localizeInstance);
exports.default = exports.localize;
//# sourceMappingURL=localize.js.map