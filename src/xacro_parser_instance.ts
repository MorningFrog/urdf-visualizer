import * as fs from "fs";

import { XacroParser } from "xacro-parser";
const { JSDOM } = require("jsdom");

global.DOMParser = new JSDOM().window.DOMParser;

// 创建自定义表达式解析器
// https://stackoverflow.com/a/175787
export function isNumber(str) {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
}
import { Parser } from "expr-eval";
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
                let curr = obj;
                for (let i = 0, l = args.length; i < l; i++) {
                    curr = curr[args[i]];
                }

                return curr;
            },
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
        };
    }
}

const xacroParser = new XacroParser(); // xacro 解析器

// 在 xacroParser 中使用自定义的表达式解析器
// @ts-ignore
xacroParser.expressionParser = new ExpressionParser();

// 在 xacroParser 中使用 fs 读取文件内容
// @ts-ignore
xacroParser.getFileContents = (filePath: string) => {
    return fs.readFileSync(filePath, { encoding: "utf8" });
};

export { xacroParser };
