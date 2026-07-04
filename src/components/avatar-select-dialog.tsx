/**
 * AvatarSelectDialog —— 头像选择网格弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 searchAvatar（L548-554，
 * 原 archetype/jhs.user.js L11404 的 layer.open content）：标题提示
 * （gfriends-prompt，显示初始头像张数）+ 滚动容器内的头像网格
 * （gfriends-image-list，每项为 gfriends-image-item-wrapper，含可选图片
 * 与尺寸标签 gfriends-size-tag）。
 *
 * 保留原 HTML 结构、id（gfriends-image-list-container/gfriends-prompt/
 * gfriends-image-list/wrapper-${index}）、类名（gfriends-image-item-wrapper/
 * gfriends-selectable-img/gfriends-size-tag）、data-* 属性
 * （data-url/data-wrapper-id/data-size-for）、内联 style（经 CSSProperties
 * 对象还原为 kebab-case CSS 字符串，值原样保留）。原 content 内的 <style>
 * 块（gfriends-* 选择器样式）已提取为 src/styles/avatar-select-dialog.css，
 * 由插件 initCss 注入（content 不含 style 标签）。头像 URL 列表（原 avatarUrls）
 * 通过 props 注入，组件内 map 生成图片项并在标题提示中插入张数。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 searchAvatar 中 layer.open({ content })
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串，再与前缀
 * `<style>` 块拼接（复刻原 content = `<style>块 + HTML`，字符级一致）：
 *   `layer.open({ content: "<style>" + avatarSelectDialogCssRaw + "</style>" + jsxToString(<AvatarSelectDialog avatarUrls={...} />), ... })`
 * 图片 load/error 处理（尺寸标签回填、错误图片移除、剩余计数、全失效关闭）、
 * 点击选中回填编辑弹窗头像仍由 searchAvatar 的 success 回调持有，
 * 组件只负责静态结构 + 动态头像列表插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。本弹窗含动态值（头像 URL 列表），故用 props。
 */

/** AvatarSelectDialog 的属性。 */
interface AvatarSelectDialogProps {
    /** 头像 URL 列表（原 avatarUrls，由 loadGfriends 返回）。 */
    avatarUrls: string[];
}

/**
 * 渲染头像选择网格弹窗的 JSX。
 * @param props.avatarUrls 头像 URL 列表。
 * @returns 头像选择网格弹窗 JSX（标题提示 + 滚动容器 + 头像网格），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 直接消费。
 *          CSS 由插件 initCss 注入（src/styles/avatar-select-dialog.css）。
 */
export function AvatarSelectDialog({ avatarUrls }: AvatarSelectDialogProps) {
    return (
        <div id="gfriends-image-list-container">
            <p
                id="gfriends-prompt"
                style={{
                    textAlign: 'center',
                    fontSize: '15px',
                    marginBottom: '15px'
                }}
            >
                点击图片即可选择（初始共 {avatarUrls.length} 张）
            </p>
            <div style={{ overflowY: 'auto', height: 'calc(100% - 40px)' }}>
                <div id="gfriends-image-list">
                    {avatarUrls.map((url, index) => (
                        <div
                            key={index}
                            id={`wrapper-${index}`}
                            className="gfriends-image-item-wrapper"
                        >
                            <img
                                alt=""
                                src={url}
                                data-url={url}
                                className="gfriends-selectable-img"
                                data-wrapper-id={`wrapper-${index}`}
                            />
                            <div className="gfriends-size-tag" data-size-for={`wrapper-${index}`}>
                                ...
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
