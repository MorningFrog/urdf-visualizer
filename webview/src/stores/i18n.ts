// 没有使用响应式, 因为翻译信息通常在初始化时加载一次

export const i18nMessages: Record<string, string> = {};

export function i18n(key: string, ...args: any[]): string {
    const message = i18nMessages[key] || key;
    return args.length
        ? message.replace(
              /\{(\d+)\}/g,
              (match, rest: any[]) => args[rest[0]] || match
          )
        : message;
}
export default i18n;
