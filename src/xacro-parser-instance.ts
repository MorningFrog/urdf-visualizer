import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { Parser } from "expr-eval";
import * as yaml from "js-yaml";
import * as vscode from "vscode";
import { XacroParser } from "xacro-parser";
const {
    DOMParser: XmldomDOMParser,
} = require("xmldom");

type CompatNodeList<T> = {
    length: number;
    [index: number]: T;
    [Symbol.iterator]?: () => Iterator<T>;
};

type CompatNode = {
    childNodes: CompatNodeList<CompatNode> | null;
    children?: CompatNode[];
    nodeType: number;
    ELEMENT_NODE: number;
    documentElement?: CompatNode;
    createTextNode?: (data: string) => CompatNode;
};

function collectionToArray<T>(collection: { length: number; [index: number]: T }) {
    const items: T[] = [];
    for (let i = 0; i < collection.length; i++) {
        items.push(collection[i]);
    }
    return items;
}

function createEmptyNodeList(
    nodeListPrototype: object | null
): CompatNodeList<CompatNode> {
    const emptyNodeList = Object.create(nodeListPrototype ?? Object.prototype);
    emptyNodeList.length = 0;
    return emptyNodeList;
}

function installXmldomCompatibility(documentNode: CompatNode) {
    const nodeListProto = documentNode.childNodes
        ? Object.getPrototypeOf(documentNode.childNodes)
        : Object.prototype;

    const installTextContentStringCoercion = () => {
        if (!documentNode.createTextNode) {
            return;
        }

        const textPrototype = Object.getPrototypeOf(documentNode.createTextNode(""));
        if (!textPrototype || Object.getOwnPropertyDescriptor(textPrototype, "textContent")) {
            return;
        }

        Object.defineProperty(textPrototype, "textContent", {
            get(this: { data?: unknown }) {
                return this.data ?? "";
            },
            set(
                this: {
                    data?: unknown;
                    value?: unknown;
                    nodeValue?: unknown;
                    length?: number;
                },
                data: unknown
            ) {
                const normalized =
                    data === null || data === undefined ? "" : String(data);
                this.data = normalized;
                this.value = normalized;
                this.nodeValue = normalized;
                this.length = normalized.length;
            },
            configurable: true,
        });
    };

    installTextContentStringCoercion();

    if (nodeListProto && !nodeListProto[Symbol.iterator]) {
        Object.defineProperty(nodeListProto, Symbol.iterator, {
            value: function* <T>(this: CompatNodeList<T>) {
                for (let i = 0; i < this.length; i++) {
                    yield this[i];
                }
            },
            configurable: true,
        });
    }

    const normalizeNode = (node: CompatNode) => {
        if (!node.childNodes) {
            node.childNodes = createEmptyNodeList(nodeListProto);
            return;
        }

        const children = collectionToArray(node.childNodes);
        for (const child of children) {
            normalizeNode(child);
        }
    };

    const defineChildrenGetter = (target: object | null) => {
        if (!target || Object.getOwnPropertyDescriptor(target, "children")) {
            return;
        }

        Object.defineProperty(target, "children", {
            get(this: CompatNode) {
                return collectionToArray(this.childNodes ?? createEmptyNodeList(nodeListProto)).filter(
                    (child) => child.nodeType === this.ELEMENT_NODE
                );
            },
            configurable: true,
        });
    };

    normalizeNode(documentNode);
    defineChildrenGetter(Object.getPrototypeOf(documentNode));
    defineChildrenGetter(Object.getPrototypeOf(documentNode.documentElement));
}

class CompatibleDOMParser {
    private readonly parser = new XmldomDOMParser();

    parseFromString(source: string, mimeType: string) {
        const documentNode = this.parser.parseFromString(
            source,
            mimeType
        ) as CompatNode;
        installXmldomCompatibility(documentNode);
        return documentNode;
    }
}

(globalThis as any).DOMParser = CompatibleDOMParser;

// 创建自定义表达式解析器
// https://stackoverflow.com/a/175787
export function isNumber(str) {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
}

const MAX_LOAD_YAML_BYTES = 10 * 1024 * 1024;
const PARENT_SCOPE = Symbol("parent");
let loadYamlWorkspaceRootsForTests: string[] | null = null;
let currentLoadYamlBasePath: string | null = null;

export function setLoadYamlWorkspaceRootsForTests(
    workspaceRoots: string[] | null
) {
    loadYamlWorkspaceRootsForTests = workspaceRoots;
}

function getLoadYamlWorkspaceRoots(): string[] {
    return loadYamlWorkspaceRootsForTests ??
        (vscode.workspace.workspaceFolders ?? []).map(
            (folder) => folder.uri.fsPath
        );
}

function normalizeForPlatform(filePath: string): string {
    return process.platform === "win32" ? filePath.toLowerCase() : filePath;
}

function isPathInside(parentPath: string, childPath: string): boolean {
    const relativePath = path.relative(
        normalizeForPlatform(parentPath),
        normalizeForPlatform(childPath)
    );
    return (
        relativePath === "" ||
        (
            !relativePath.startsWith("..") &&
            !path.isAbsolute(relativePath)
        )
    );
}

function resolveLoadYamlPath(filePath: string): string {
    if (typeof filePath !== "string" || filePath.trim() === "") {
        throw new Error("xacro.load_yaml() requires a non-empty file path.");
    }

    const workspaceRoots = getLoadYamlWorkspaceRoots().map((root) =>
        fs.realpathSync.native(root)
    );

    if (workspaceRoots.length === 0) {
        throw new Error(
            "xacro.load_yaml() is disabled because no VS Code workspace is open."
        );
    }

    let normalizedPath = filePath;
    if (/^file:/i.test(normalizedPath)) {
        normalizedPath = fileURLToPath(normalizedPath);
    }

    const basePath = currentLoadYamlBasePath ?? xacroParser.workingPath ?? "";
    const absolutePath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.resolve(basePath, normalizedPath);
    const realPath = fs.realpathSync.native(absolutePath);

    if (!workspaceRoots.some((root) => isPathInside(root, realPath))) {
        throw new Error(
            `xacro.load_yaml() can only read files inside the current workspace: ${filePath}`
        );
    }

    const stat = fs.statSync(realPath);
    if (!stat.isFile()) {
        throw new Error(`xacro.load_yaml() path is not a file: ${filePath}`);
    }
    if (stat.size > MAX_LOAD_YAML_BYTES) {
        throw new Error(
            `xacro.load_yaml() refuses to read files larger than ${MAX_LOAD_YAML_BYTES} bytes: ${filePath}`
        );
    }

    return realPath;
}

type PropertyScope = Record<string, unknown> & {
    [PARENT_SCOPE]?: PropertyScope;
};

type XacroRuntime = {
    parser: any;
    argumentDefaults: Record<string, unknown>;
};

type MacroParam = {
    type: "PARAM" | "BLOCK" | "MULTI_BLOCK";
    name: string;
    def: string | null;
};

type MacroDefinition = {
    name: string;
    node: any;
    params: Record<string, MacroParam>;
    basePath: string;
};

class LazyProperty {
    private cached = false;
    private cachedValue: unknown;
    private resolving = false;

    constructor(
        private readonly name: string,
        private readonly rawValue: unknown,
        private readonly scope: PropertyScope,
        private readonly runtime: XacroRuntime,
        private readonly basePath: string
    ) {}

    resolve(stack: string[]): unknown {
        if (this.cached) {
            return this.cachedValue;
        }

        if (this.resolving || stack.includes(this.name)) {
            throw new Error(
                `Circular xacro property reference detected: ${[
                    ...stack,
                    this.name,
                ].join(" -> ")}`
            );
        }

        this.resolving = true;
        try {
            this.cachedValue = evaluateAttribute(
                this.rawValue,
                this.scope,
                this.runtime,
                false,
                this.basePath,
                [...stack, this.name]
            );
            this.cached = true;
            return this.cachedValue;
        } finally {
            this.resolving = false;
        }
    }
}

function getUrlBase(url: string): string {
    const tokens = url.split(/[\\/]/g);
    tokens.pop();
    return tokens.length === 0 ? "./" : `${tokens.join("/")}/`;
}

function isAbsoluteLike(filePath: string): boolean {
    return /^[/\\]/.test(filePath) || /^[a-zA-Z]+:[/\\]/.test(filePath);
}

function resolveRelativeFile(basePath: string, filePath: string): string {
    return isAbsoluteLike(filePath) ? filePath : path.resolve(basePath, filePath);
}

function stripTrailingSeparators(filePath: string): string {
    return filePath.replace(/[\\/]+$/, "");
}

function deepClone(node: any, stripPropsMacros: boolean) {
    const cloned = node.cloneNode();
    const childNodes = node.childNodes ?? [];
    for (let i = 0, l = childNodes.length; i < l; i++) {
        const child = childNodes[i];
        const tagName = child.tagName;
        if (
            !stripPropsMacros ||
            (tagName !== "xacro:property" && tagName !== "xacro:macro")
        ) {
            cloned.appendChild(deepClone(child, stripPropsMacros));
        }
    }
    return cloned;
}

function removeEndCommentsFromArray(nodes: any[]) {
    while (nodes.length > 0) {
        const node = nodes[nodes.length - 1];
        if (node.nodeType !== node.ELEMENT_NODE) {
            nodes.pop();
        } else {
            break;
        }
    }
}

function mergePropertySets(...scopes: PropertyScope[]): PropertyScope {
    const result: PropertyScope = {};
    for (const scope of scopes) {
        for (const key in scope) {
            result[key] = scope[key];
        }
        if (scope[PARENT_SCOPE]) {
            result[PARENT_SCOPE] = scope[PARENT_SCOPE];
        }
    }
    return result;
}

function createNewPropertyScope(properties: PropertyScope): PropertyScope {
    const result = mergePropertySets(properties);
    result[PARENT_SCOPE] = properties;
    return result;
}

function hasScopedProperty(scope: PropertyScope, name: string): boolean {
    let current: PropertyScope | undefined = scope;
    while (current) {
        if (Object.prototype.hasOwnProperty.call(current, name)) {
            return true;
        }
        current = current[PARENT_SCOPE];
    }
    return false;
}

function getScopedProperty(scope: PropertyScope, name: string): unknown {
    let current: PropertyScope | undefined = scope;
    while (current) {
        if (Object.prototype.hasOwnProperty.call(current, name)) {
            return current[name];
        }
        current = current[PARENT_SCOPE];
    }
    return undefined;
}

function collectScopedPropertyKeys(scope: PropertyScope): string[] {
    const keys = new Set<string>();
    let current: PropertyScope | undefined = scope;
    while (current) {
        for (const key of Object.keys(current)) {
            keys.add(key);
        }
        current = current[PARENT_SCOPE];
    }
    return [...keys];
}

function resolveScopedValue(value: unknown, stack: string[]): unknown {
    if (value instanceof LazyProperty) {
        return value.resolve(stack);
    }
    return value;
}

function createScopedValues(
    scope: PropertyScope,
    stack: string[]
): Record<string, unknown> {
    return new Proxy(
        {},
        {
            has(_target, prop) {
                return typeof prop === "string" && hasScopedProperty(scope, prop);
            },
            get(_target, prop) {
                if (prop === "hasOwnProperty") {
                    return (name: string) => hasScopedProperty(scope, name);
                }
                if (typeof prop !== "string") {
                    return undefined;
                }
                return resolveScopedValue(getScopedProperty(scope, prop), stack);
            },
            ownKeys() {
                return collectScopedPropertyKeys(scope);
            },
            getOwnPropertyDescriptor(_target, prop) {
                if (typeof prop !== "string" || !hasScopedProperty(scope, prop)) {
                    return undefined;
                }
                return {
                    configurable: true,
                    enumerable: true,
                    value: resolveScopedValue(getScopedProperty(scope, prop), stack),
                };
            },
        }
    );
}

function normalizeExpression(expression: string): string {
    return expression.replace(/[-+]{2,}/, (value) => {
        let positive = true;
        for (let i = 0, l = value.length; i < l; i++) {
            if (value[i] === "-") {
                positive = !positive;
            }
        }
        return positive ? "+" : "-";
    });
}

function readBalancedExpression(source: string, start: number) {
    let i = start + 2;
    let depth = 1;
    let quote: string | null = null;
    let escaped = false;

    while (i < source.length) {
        const char = source[i];

        if (quote !== null) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            i++;
            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            i++;
            continue;
        }

        if (char === "$" && source[i + 1] === "{") {
            depth++;
            i += 2;
            continue;
        }

        if (char === "}") {
            depth--;
            if (depth === 0) {
                return {
                    content: source.slice(start + 2, i),
                    end: i + 1,
                };
            }
        }

        i++;
    }

    throw new Error(`Unterminated xacro expression in "${source}"`);
}

function readBalancedCommand(source: string, start: number) {
    let i = start + 2;
    let depth = 1;
    let quote: string | null = null;
    let escaped = false;

    while (i < source.length) {
        const char = source[i];

        if (quote !== null) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            i++;
            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            i++;
            continue;
        }

        if (char === "(") {
            depth++;
        } else if (char === ")") {
            depth--;
            if (depth === 0) {
                return {
                    content: source.slice(start + 2, i),
                    end: i + 1,
                };
            }
        }

        i++;
    }

    throw new Error(`Unterminated xacro substitution command in "${source}"`);
}

function readQuotedLiteral(source: string, start: number) {
    const quote = source[start];
    let i = start + 1;
    let escaped = false;

    while (i < source.length) {
        const char = source[i];
        if (escaped) {
            escaped = false;
        } else if (char === "\\") {
            escaped = true;
        } else if (char === quote) {
            return {
                raw: source.slice(start, i + 1),
                content: source.slice(start + 1, i),
                end: i + 1,
            };
        }
        i++;
    }

    throw new Error(`Unterminated string literal in "${source}"`);
}

function readBalancedBracket(source: string, start: number) {
    let i = start + 1;
    let depth = 1;
    let quote: string | null = null;
    let escaped = false;

    while (i < source.length) {
        const char = source[i];

        if (quote !== null) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            i++;
            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            i++;
            continue;
        }

        if (char === "[") {
            depth++;
        } else if (char === "]") {
            depth--;
            if (depth === 0) {
                return {
                    content: source.slice(start + 1, i),
                    end: i + 1,
                };
            }
        }

        i++;
    }

    throw new Error(`Unterminated bracket accessor in "${source}"`);
}

function splitCommand(command: string): string[] {
    const result: string[] = [];
    let token = "";
    let quote: string | null = null;
    let escaped = false;

    const pushToken = () => {
        if (token !== "") {
            result.push(token);
            token = "";
        }
    };

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (quote !== null) {
            if (escaped) {
                token += char;
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            } else {
                token += char;
            }
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            pushToken();
        } else {
            token += char;
        }
    }

    pushToken();
    return result;
}

function toExpressionLiteral(value: unknown): string {
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (value === null) {
        return "null";
    }
    return JSON.stringify(value);
}

function handleSubstitutionCommand(
    commandSource: string,
    properties: PropertyScope,
    runtime: XacroRuntime,
    basePath: string,
    stack: string[]
): unknown {
    const commandText = String(
        evaluateAttribute(commandSource, properties, runtime, false, basePath, stack)
    );
    const tokens = splitCommand(commandText);
    const stem = tokens.shift();

    if (!stem) {
        throw new Error("XacroParser: Empty substitution command.");
    }

    const rospackCommands = runtime.parser.rospackCommands;
    let result: unknown;
    if (rospackCommands instanceof Function) {
        result = rospackCommands(stem, ...tokens);
    }

    if (
        result === null || result === undefined
    ) {
        if (
            rospackCommands !== null &&
            rospackCommands !== undefined &&
            typeof rospackCommands[stem] === "function"
        ) {
            result = rospackCommands[stem](...tokens);
        }
    }

    if ((result === null || result === undefined) && stem === "arg") {
        const arg = tokens[0];
        if (arg === undefined) {
            throw new Error("XacroParser: $(arg) must specify a variable name");
        }
        result = runtime.parser.arguments?.[arg];
        if (result === null || result === undefined) {
            result = runtime.argumentDefaults[arg];
        }
        if (result === null || result === undefined) {
            throw new Error(`XacroParser: Undefined substitution argument ${arg}`);
        }
    }

    if ((result === null || result === undefined) && stem === "env") {
        const envName = tokens[0];
        if (!envName) {
            throw new Error("XacroParser: $(env) must specify a variable name");
        }
        result = process.env[envName];
        if (result === null || result === undefined) {
            throw new Error(`XacroParser: Environment variable ${envName} is not set`);
        }
    }

    if ((result === null || result === undefined) && stem === "optenv") {
        const envName = tokens.shift();
        if (!envName) {
            throw new Error("XacroParser: $(optenv) must specify a variable name");
        }
        result = process.env[envName] ?? tokens.join(" ");
    }

    if ((result === null || result === undefined) && stem === "dirname") {
        result = stripTrailingSeparators(basePath);
    }

    if ((result === null || result === undefined) && stem === "eval") {
        result = evaluateExpression(tokens.join(" "), properties, runtime, basePath, stack);
    }

    if (result === null || result === undefined) {
        throw new Error(`XacroParser: Cannot run substitution command "$(${commandText})".`);
    }

    return result;
}
function evaluateAttribute(
    value: unknown,
    properties: PropertyScope,
    runtime: XacroRuntime,
    finalValue = false,
    basePath = "",
    stack: string[] = []
): unknown {
    if (typeof value !== "string") {
        return value;
    }

    const results: unknown[] = [];
    let text = "";
    let i = 0;

    const flushText = () => {
        if (text !== "") {
            results.push(text);
            text = "";
        }
    };

    try {
        while (i < value.length) {
            const char = value[i];
            const next = value[i + 1];

            if (
                char === "$" &&
                next === "$" &&
                (value[i + 2] === "{" || value[i + 2] === "(")
            ) {
                text += "$$";
                i += 2;
                continue;
            }

            if (char === "$" && next === "{") {
                flushText();
                const token = readBalancedExpression(value, i);
                results.push(
                    evaluateExpression(
                        token.content,
                        properties,
                        runtime,
                        basePath,
                        stack
                    )
                );
                i = token.end;
                continue;
            }

            if (char === "$" && next === "(") {
                flushText();
                const token = readBalancedCommand(value, i);
                results.push(
                    handleSubstitutionCommand(
                        token.content,
                        properties,
                        runtime,
                        basePath,
                        stack
                    )
                );
                i = token.end;
                continue;
            }

            text += char;
            i++;
        }

        flushText();

        const trimmedResults = results.filter((result) => {
            if (typeof result === "string") {
                result = result.trim();
            }
            return result !== "" && result !== null && result !== undefined;
        });

        let result =
            trimmedResults.length === 1
                ? trimmedResults[0]
                : results.map((result) => String(result)).join("");

        if (finalValue && typeof result === "string") {
            result = result.replace(/\${2}([({])/g, (_value, brace) => `$${brace}`);
        }

        return result;
    } catch (error) {
        throw new Error(
            `XacroParser: Failed to process expression "${value}". \n` +
                (error instanceof Error ? error.message : String(error))
        );
    }
}

function interpolateExpressionSubstitutions(
    expression: string,
    properties: PropertyScope,
    runtime: XacroRuntime,
    basePath: string,
    stack: string[]
): string {
    let result = "";
    let i = 0;

    while (i < expression.length) {
        const char = expression[i];
        const next = expression[i + 1];

        if (char === "'" || char === '"' || char === "`") {
            const literal = readQuotedLiteral(expression, i);
            if (
                literal.content.includes("$(") ||
                literal.content.includes("${") ||
                literal.content.includes("$$")
            ) {
                const value = evaluateAttribute(
                    literal.content,
                    properties,
                    runtime,
                    false,
                    basePath,
                    stack
                );
                result += JSON.stringify(String(value));
            } else {
                result += literal.raw;
            }
            i = literal.end;
            continue;
        }

        if (char === "$" && next === "(") {
            const token = readBalancedCommand(expression, i);
            result += toExpressionLiteral(
                handleSubstitutionCommand(
                    token.content,
                    properties,
                    runtime,
                    basePath,
                    stack
                )
            );
            i = token.end;
            continue;
        }

        if (char === "$" && next === "{") {
            const token = readBalancedExpression(expression, i);
            result += toExpressionLiteral(
                evaluateExpression(token.content, properties, runtime, basePath, stack)
            );
            i = token.end;
            continue;
        }

        result += char;
        i++;
    }

    return result;
}

function rewriteDictionaryAccessors(expression: string): string {
    let result = "";
    let i = 0;

    const readIdentifierPath = (start: number) => {
        let index = start;
        const readIdentifier = () => {
            if (!/[A-Za-z_$]/.test(expression[index] ?? "")) {
                return false;
            }
            index++;
            while (/[A-Za-z0-9_$]/.test(expression[index] ?? "")) {
                index++;
            }
            return true;
        };

        if (!readIdentifier()) {
            return null;
        }

        while (expression[index] === ".") {
            const dotIndex = index;
            index++;
            if (!readIdentifier()) {
                index = dotIndex;
                break;
            }
        }

        return {
            root: expression.slice(start, index),
            end: index,
        };
    };

    while (i < expression.length) {
        const char = expression[i];
        if (char === "'" || char === '"' || char === "`") {
            const literal = readQuotedLiteral(expression, i);
            result += literal.raw;
            i = literal.end;
            continue;
        }

        const identifier = readIdentifierPath(i);
        if (!identifier || expression[identifier.end] !== "[") {
            result += char;
            i++;
            continue;
        }

        const keys: string[] = [];
        let end = identifier.end;
        while (expression[end] === "[") {
            const bracket = readBalancedBracket(expression, end);
            keys.push(bracket.content);
            end = bracket.end;
        }

        result += `__read_property__( ${identifier.root},${keys.join(",")} )`;
        i = end;
    }

    return result;
}

function evaluateExpression(
    expression: string,
    properties: PropertyScope,
    runtime: XacroRuntime,
    basePath: string,
    stack: string[]
): unknown {
    const expressionWithSubstitutions = interpolateExpressionSubstitutions(
        expression,
        properties,
        runtime,
        basePath,
        stack
    );
    const expressionWithAccessors = rewriteDictionaryAccessors(expressionWithSubstitutions);
    const cleanExpression = normalizeExpression(expressionWithAccessors);
    const previousBasePath = currentLoadYamlBasePath;
    currentLoadYamlBasePath = basePath;
    try {
        return runtime.parser.expressionParser.evaluate(
            cleanExpression,
            createScopedValues(properties, stack) as any
        );
    } finally {
        currentLoadYamlBasePath = previousBasePath;
    }
}

function normalizeExponentOperator(expression: string): string {
    // Rewrite `xacro.load_yaml(` -> `load_yaml(` because expr-eval can't
    // dispatch member calls on object consts.
    expression = expression.replace(
        /\bxacro\.load_yaml\s*\(/g,
        "load_yaml("
    );

    let normalized = "";
    let quote: string | null = null;
    let escaped = false;

    for (let i = 0; i < expression.length; i++) {
        const char = expression[i];
        const nextChar = expression[i + 1];

        if (quote !== null) {
            normalized += char;

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === "\\") {
                escaped = true;
                continue;
            }

            if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            normalized += char;
            continue;
        }

        if (char === "*" && nextChar === "*") {
            normalized += "^";
            i++;
            continue;
        }

        // Re-merge "a > = b" -> "a >= b". xacro-parser tokenizer bug.
        // TODO: remove once fixed in gkjohnson/xacro-parser.
        if (char === ">" || char === "<" || char === "=" || char === "!") {
            if (nextChar === "=") {
                normalized += char + "=";
                i++;
                continue;
            }
            if (nextChar === " " && expression[i + 2] === "=") {
                normalized += char + "=";
                i += 2;
                continue;
            }
        }

        normalized += char;
    }

    return normalized;
}

class ExpressionParser extends Parser {
    constructor(...args) {
        super(...args);

        const parser = this;
        parser.unaryOps = {
            "-": parser.unaryOps["-"],
            "+": parser.unaryOps["+"],
            "!": parser.unaryOps["not"],
            not: parser.unaryOps["not"],
        };

        parser.functions = {
            abs: Math.abs,
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            asin: Math.asin,
            asinh: Math.asinh,
            acos: Math.acos,
            acosh: Math.acosh,
            atan: Math.atan,
            atan2: Math.atan2,
            atanh: Math.atanh,
            log: (x, base = Math.E) => Math.log(x) / Math.log(base),
            sqrt: Math.sqrt,
            pow: Math.pow,
            ceil: Math.ceil,
            floor: Math.floor,
            radians: (degrees) => {
                return degrees * (Math.PI / 180);
            },
            degrees: (radians) => {
                return radians * (180 / Math.PI);
            },

            comb: (n, k) => {
                // 计算组合数 C(n, k)
                if (k < 0 || k > n) {
                    return 0;
                }
                if (k === 0 || k === n) {
                    return 1;
                }
                if (k > n / 2) {
                    k = n - k; // 利用对称性
                }
                let c = 1;
                for (let i = 0; i < k; i++) {
                    c = (c * (n - i)) / (i + 1);
                }
                return c;
            },
            copysign: (x, y) => {
                // 返回 x 的符号与 y 相同的值
                return Math.abs(x) * Math.sign(y);
            },
            dist: (p, q) => {
                // 计算两点之间的距离
                // python: sqrt(sum((px - qx) ** 2.0 for px, qx in zip(p, q)))
                return Math.sqrt(
                    p.reduce((sum, px, i) => sum + Math.pow(px - q[i], 2), 0)
                );
            },
            expm1: Math.expm1,
            fabs: Math.abs,
            factorial: (n) => {
                // 计算阶乘
                if (n < 0) {
                    throw new Error(
                        "Factorial is not defined for negative numbers"
                    );
                }
                if (n === 0 || n === 1) {
                    return 1;
                }
                let result = 1;
                for (let i = 2; i <= n; i++) {
                    result *= i;
                }
                return result;
            },
            fmod: (x, y) => {
                // 计算 x 除以 y 的余数
                return x - y * Math.floor(x / y);
            },
            fsum: (iterable) => {
                // 计算可迭代对象的总和,使用 Kahan 求和算法
                let sum = 0;
                let c = 0; // 误差
                for (const x of iterable) {
                    const y = x - c; // 先减去上次的误差
                    const t = sum + y; // 先加上当前值
                    c = t - sum - y; // 计算新的误差
                    sum = t; // 更新总和
                }
                return sum;
            },
            gamma: (x) => {
                // 计算伽马函数
                // 使用 Lanczos 近似
                const gamma_core = (x) => {
                    const p = [
                        676.5203681218851, -1259.1392167224028,
                        771.3234287776536, -176.6150291498386,
                        12.507343278686905, -0.1385710952657201,
                        9.984369578019571e-6,
                    ];
                    let num = 0;
                    let denom = 0;
                    for (let i = 0; i < p.length; i++) {
                        const coeff = p[i];
                        num += coeff / (x + i + 1);
                        denom += coeff / (x + i + 1);
                    }
                    return (
                        Math.sqrt(2 * Math.PI) *
                        Math.pow(x + 1, x + 0.5) *
                        Math.exp(-x) *
                        (num / denom)
                    );
                };
                if (x < 0.5) {
                    // 使用反射公式
                    return (
                        Math.PI / (Math.sin(Math.PI * x) * gamma_core(1 - x))
                    );
                } else {
                    return gamma_core(x - 1);
                }
            },
            gcd: (...args) => {
                // 计算最大公约数
                const gcd = (a, b) => {
                    while (b !== 0) {
                        const t = b;
                        b = a % b;
                        a = t;
                    }
                    return a;
                };
                return args.reduce(gcd);
            },
            lcm: (...args) => {
                // 计算最小公倍数
                const lcm = (a, b) => {
                    return (a * b) / gcd(a, b);
                };
                const gcd = (a, b) => {
                    while (b !== 0) {
                        const t = b;
                        b = a % b;
                        a = t;
                    }
                    return a;
                };
                return args.reduce(lcm);
            },
            hypot: (...args) => {
                // 计算欧几里得范数
                // python: sqrt(sum(x ** 2 for x in args))
                return Math.sqrt(args.reduce((sum, x) => sum + x * x, 0));
            },
            isinf: (x) => !isFinite(x),
            isinfinite: (x) => !isFinite(x),
            isnan: (x) => isNaN(x),
            isqrt: (x) => Math.floor(Math.sqrt(x)),
            log10: (x) => Math.log10(x),
            log1p: (x) => Math.log1p(x), // log(1 + x)
            log2: (x) => Math.log2(x),
            modf: (x) => {
                // 返回整数部分和小数部分
                const intPart = Math.floor(x);
                const fracPart = x - intPart;
                return [fracPart, intPart];
            },
            perm: (n, k) => {
                // 计算排列数 P(n, k)
                if (k < 0 || k > n) {
                    return 0;
                }
                if (k === 0) {
                    return 1;
                }
                let p = 1;
                for (let i = 0; i < k; i++) {
                    p *= n - i;
                }
                return p;
            },
            prod: (iterable) => {
                // 计算可迭代对象的乘积
                return iterable.reduce((product, x) => product * x, 1);
            },

            __read_property__: (obj, ...args) => {
                let curr: any = obj;
                for (let i = 0, l = args.length; i < l; i++) {
                    curr = curr[args[i]];
                }

                return curr;
            },

            // Python len() — strings and arrays both have .length in JS.
            len: (x) =>
                x === null || x === undefined
                    ? 0
                    : typeof x.length === "number"
                        ? x.length
                        : 0,

            // xacro.load_yaml(path) — Python xacro builtin. See the rewrite in
            // normalizeExponentOperator() that converts `xacro.load_yaml(` to `load_yaml(`.
            load_yaml: (filePath: string) =>
                yaml.load(fs.readFileSync(resolveLoadYamlPath(filePath), "utf8")),
        };

        // @ts-ignore
        parser.binaryOps = {
            // @ts-ignore
            ...parser.binaryOps,
            "+": (a, b) => {
                if (isNumber(a)) {
                    a = Number(a);
                }

                if (isNumber(b)) {
                    b = Number(b);
                }

                return a + b;
            },
            "==": (a, b) => {
                if (isNumber(a) && isNumber(b)) {
                    return Number(a) === Number(b);
                }
                return a === b;
            },
            "!=": (a, b) => {
                if (isNumber(a) && isNumber(b)) {
                    return Number(a) !== Number(b);
                }
                return a !== b;
            },
            in: (a, b) => {
                if (Array.isArray(b)) {
                    return b.includes(a);
                } else if (typeof b === "string") {
                    return b.includes(a);
                } else {
                    return a in b;
                }
            },
            "||": (a, b) => Boolean(a || b),

            // binary AND is not supported by expr-eval. See expr-eval issue #253.
            // '&&': (a, b) => Boolean(a || b),
        };

        parser.consts = {
            ...parser.consts,
            pi: Math.PI,
            e: Math.E,
            True: true,
            False: false,
            inf: Infinity,
            nan: NaN,
            tau: Math.PI * 2,
            // Python xacro builtins, namespaced to match real-xacro shape.
            // xacro: {
            //     load_yaml: (filePath: string) =>
            //         yaml.load(fs.readFileSync(filePath, "utf8")),
            // },
        };
    }

    evaluate(expr, values) {
        const normalizedExpr = normalizeExponentOperator(expr);
        const previousValues = (
            this as unknown as { currentEvaluationValues?: Record<string, unknown> }
        ).currentEvaluationValues;
        (
            this as unknown as { currentEvaluationValues?: Record<string, unknown> }
        ).currentEvaluationValues = values;
        try {
            return super.evaluate(normalizedExpr, values);
        } finally {
            (
                this as unknown as { currentEvaluationValues?: Record<string, unknown> }
            ).currentEvaluationValues = previousValues;
        }
    }
}

async function parseXacroCompat(this: any, data: string) {
    const runtime: XacroRuntime = {
        parser: this,
        argumentDefaults: {},
    };
    const requirePrefix = this.requirePrefix;
    const workingPath =
        this.workingPath +
        (this.workingPath && !/[\\/]$/.test(this.workingPath) ? "/" : "");
    const globalMacros: Record<string, MacroDefinition> = {};
    const globalProperties: PropertyScope = { True: 1, False: 0 };
    globalProperties[PARENT_SCOPE] = globalProperties;
    let localProperties = this.localProperties;

    if (localProperties && !this.inOrder) {
        console.warn(
            'XacroParser: Implicitly setting "localProperties" option to false because "inOrder" is false.'
        );
        localProperties = false;
    }

    const loadInclude = async (filePath: string) => {
        try {
            const text = await this.getFileContents(filePath);
            return new DOMParser().parseFromString(text, "text/xml");
        } catch (error) {
            throw new Error(
                `XacroParser: Could not load included file: ${filePath}. ` +
                    (error instanceof Error ? error.message : String(error))
            );
        }
    };

    const parseMacroParam = (param: string): MacroParam => {
        const result: MacroParam = {
            type: "PARAM",
            name: param,
            def: null,
        };

        if (/^\*\*/.test(param)) {
            result.type = "MULTI_BLOCK";
        } else if (/^\*/.test(param)) {
            result.type = "BLOCK";
        }

        param = param.replace(/^\*{1,2}/g, "");

        if (/:?=/.test(param)) {
            const [name, def] = param.split(/:?=/);
            if (/^\^/.test(def) || /\|/.test(def)) {
                throw new Error(
                    `XacroParser: ROS Jade pass-through notation not supported in macro defaults: ${def}`
                );
            }

            result.name = name;
            result.def =
                def.startsWith("'") && def.endsWith("'")
                    ? def.substring(1, def.length - 1)
                    : def;
        } else {
            result.name = param;
            result.def = null;
        }

        return result;
    };

    const parseMacro = (node: any, basePath: string): MacroDefinition => {
        const name = node.getAttribute("name").replace(/^xacro:/, "");
        const params = node.getAttribute("params");
        const inputMap: Record<string, MacroParam> = {};

        if (params) {
            const inputs = params
                .trim()
                .match(/[^\s']+('[^']*')?/g);
            inputs?.forEach((input) => {
                const parsed = parseMacroParam(input);
                inputMap[parsed.name] = parsed;
            });
        }

        return {
            name,
            node: deepClone(node, false),
            params: inputMap,
            basePath,
        };
    };

    const evaluateMacro = async (
        node: any,
        properties: PropertyScope,
        macros: Record<string, MacroDefinition>,
        resultsList: any[],
        callBasePath: string
    ) => {
        const macroName = node.tagName.replace(/^xacro:/, "");
        const macro = macros[macroName];
        if (!macro) {
            throw new Error(`XacroParser: Cannot find macro "${macroName}"`);
        }

        const originalProperties = properties;
        const originalMacros = macros;
        properties = createNewPropertyScope(properties);
        macros = { ...macros };

        let children: any[] = [];
        for (const child of node.children ?? []) {
            await processNode(
                child,
                originalProperties,
                originalMacros,
                children,
                callBasePath
            );
        }
        children = children.filter((child) => child.nodeType === child.ELEMENT_NODE);

        let blockCount = 0;
        for (const paramName in macro.params) {
            const param = macro.params[paramName];
            if (node.hasAttribute(paramName)) {
                properties[paramName] = evaluateAttribute(
                    node.getAttribute(paramName),
                    originalProperties,
                    runtime,
                    false,
                    callBasePath
                );
            } else if (param.type === "BLOCK") {
                properties[paramName] = [children[blockCount]];
                blockCount++;
            } else if (param.type === "MULTI_BLOCK") {
                properties[paramName] = [
                    ...children.filter((child) => child.tagName === paramName)[0]
                        .childNodes,
                ];
            } else {
                properties[paramName] = evaluateAttribute(
                    param.def,
                    originalProperties,
                    runtime,
                    false,
                    macro.basePath
                );
            }
        }

        const macroChildren = [...macro.node.childNodes];
        for (const child of macroChildren) {
            const nodes: any[] = [];
            await processNode(child, properties, macros, nodes, macro.basePath);
            resultsList.push(...nodes);
        }
    };

    const processNode = async (
        node: any,
        properties: PropertyScope,
        macros: Record<string, MacroDefinition>,
        resultsList: any[] = [],
        basePath: string
    ) => {
        if (node.nodeType === node.TEXT_NODE) {
            const result = node.cloneNode();
            result.textContent = evaluateAttribute(
                result.textContent,
                properties,
                runtime,
                true,
                basePath
            );
            resultsList.push(result);
            return;
        }

        if (node.nodeType !== node.ELEMENT_NODE) {
            resultsList.push(node.cloneNode());
            return;
        }

        let tagName = node.tagName.toLowerCase();
        if (!requirePrefix) {
            switch (tagName) {
                case "arg":
                case "property":
                case "macro":
                case "insert_block":
                case "if":
                case "unless":
                case "include":
                case "element":
                case "attribute":
                    tagName = `xacro:${tagName}`;
                    break;
                default:
                    if (tagName in macros) {
                        tagName = `xacro:${tagName}`;
                    }
                    break;
            }
        }

        switch (tagName) {
            case "xacro:property": {
                removeEndCommentsFromArray(resultsList);

                const name = node.getAttribute("name");
                let value: unknown;
                if (node.hasAttribute("value")) {
                    value = node.getAttribute("value");
                } else if (node.hasAttribute("default")) {
                    value = node.getAttribute("default");
                } else {
                    value = [...node.childNodes].map((child) => deepClone(child, false));
                }

                let scope = "global";
                if (localProperties) {
                    scope = node.getAttribute("scope") || "local";
                }

                const lazyEval = !["false", "0"].includes(
                    String(node.getAttribute("lazy_eval") ?? "true").toLowerCase()
                );
                const storedValue =
                    scope !== "local" || !lazyEval
                        ? evaluateAttribute(value, properties, runtime, false, basePath)
                        : new LazyProperty(name, value, properties, runtime, basePath);

                if (scope === "global") {
                    globalProperties[name] = storedValue;
                } else if (scope === "parent") {
                    const parentScope = properties[PARENT_SCOPE] ?? properties;
                    parentScope[name] = storedValue;
                } else {
                    properties[name] = storedValue;
                }

                break;
            }
            case "xacro:macro": {
                removeEndCommentsFromArray(resultsList);
                const macro = parseMacro(node, basePath);
                macros[macro.name] = macro;
                break;
            }
            case "xacro:insert_block": {
                removeEndCommentsFromArray(resultsList);
                const name = node.getAttribute("name");
                const nodes = resolveScopedValue(
                    getScopedProperty(properties, name),
                    []
                ) as any[];
                for (const child of nodes ?? []) {
                    await processNode(child, properties, macros, resultsList, basePath);
                }
                return;
            }
            case "xacro:if":
            case "xacro:unless": {
                removeEndCommentsFromArray(resultsList);
                const value = evaluateAttribute(
                    node.getAttribute("value"),
                    properties,
                    runtime,
                    true,
                    basePath
                );
                let bool: unknown;
                if (!isNaN(parseFloat(String(value)))) {
                    bool = !!parseFloat(String(value));
                } else if (value === "true" || value === "false") {
                    bool = value === "true";
                } else {
                    bool = value;
                }

                if (tagName === "xacro:unless") {
                    bool = !bool;
                }

                if (bool) {
                    for (const child of [...node.childNodes]) {
                        await processNode(child, properties, macros, resultsList, basePath);
                    }
                }
                return;
            }
            case "xacro:include": {
                removeEndCommentsFromArray(resultsList);

                if (node.hasAttribute("ns")) {
                    throw new Error("XacroParser: xacro:include name spaces not supported.");
                }

                const filename = String(
                    evaluateAttribute(
                        node.getAttribute("filename"),
                        properties,
                        runtime,
                        true,
                        basePath
                    )
                );
                const filePath = resolveRelativeFile(basePath, filename);
                const includeBasePath = getUrlBase(filePath);
                const includeContent = await loadInclude(filePath);
                const childNodes = [...includeContent.children[0].childNodes];
                for (const child of childNodes) {
                    await processNode(
                        child,
                        properties,
                        macros,
                        resultsList,
                        includeBasePath
                    );
                }
                return;
            }
            case "xacro:arg": {
                const name = node.getAttribute("name");
                runtime.argumentDefaults[name] = evaluateAttribute(
                    node.getAttribute("default"),
                    properties,
                    runtime,
                    true,
                    basePath
                );
                return;
            }
            case "xacro:attribute":
            case "xacro:element":
                throw new Error(`XacroParser: ${tagName} tags not supported.`);
            default: {
                if (/^xacro:/.test(tagName) || tagName in macros) {
                    removeEndCommentsFromArray(resultsList);
                    return evaluateMacro(node, properties, macros, resultsList, basePath);
                }

                const result = node.cloneNode();
                for (let i = 0, l = result.attributes.length; i < l; i++) {
                    const attr = result.attributes[i];
                    const value = evaluateAttribute(
                        attr.value,
                        properties,
                        runtime,
                        true,
                        basePath
                    );
                    result.setAttribute(attr.name, String(value));
                }

                const resultChildren: any[] = [];
                for (const child of [...node.childNodes]) {
                    await processNode(child, properties, macros, resultChildren, basePath);
                }
                resultChildren.forEach((child) => result.appendChild(child));
                resultsList.push(result);
            }
        }
    };

    const processXacro = async (
        xacro: any,
        properties: PropertyScope,
        macros: Record<string, MacroDefinition>,
        basePath: string
    ) => {
        const result = xacro.cloneNode();
        for (let i = 0, l = xacro.children.length; i < l; i++) {
            const childResults: any[] = [];
            await processNode(xacro.children[i], properties, macros, childResults, basePath);

            const root = childResults[0];
            if (root?.removeAttribute) {
                root.removeAttribute("xmlns:xacro");
            }
            if (root) {
                result.appendChild(root);
            }
        }
        return result;
    };

    const content = new DOMParser().parseFromString(data, "text/xml");
    return processXacro(content, globalProperties, globalMacros, workingPath);
}

const xacroParser = new XacroParser(); // xacro 解析器

// @ts-ignore
xacroParser.parse = parseXacroCompat.bind(xacroParser);

// Keep macro-local xacro properties scoped locally. The compat parser resolves
// lazy values through the same substitution pipeline used for normal attributes.
// @ts-ignore
xacroParser.localProperties = true;

// 在 xacroParser 中使用自定义的表达式解析器
// @ts-ignore
xacroParser.expressionParser = new ExpressionParser();

// 在 xacroParser 中使用 fs 读取文件内容
// @ts-ignore
xacroParser.getFileContents = (filePath: string) => {
    return fs.readFileSync(filePath, { encoding: "utf8" });
};

export { xacroParser };
