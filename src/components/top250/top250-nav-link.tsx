/** 将旧「猜你喜歡」标签替换为与主导航一致的增强入口。 */
export function Top250NavLink({ href }: { href: string }) {
    return (
        <a href={href}>
            <span>Top250</span>
        </a>
    );
}
