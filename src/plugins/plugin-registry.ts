/**
 * 插件注册表类型映射 —— getBean 的类型安全基础。
 *
 * PluginMap 将插件名（getName() 返回值）映射到具体插件类，
 * 使 PluginManager.getBean / BasePlugin.getBean 返回精确类型
 * 而非 any / BasePlugin | undefined。
 *
 * 新增插件时在此添加一行映射即可。
 */
import type { ActressInfoPlugin } from './actress-info-plugin';
import type { AutoPagePlugin } from './auto-page-plugin';
import type { BlacklistPlugin } from './blacklist-plugin';
import type { DetailPageButtonPlugin } from './detail-page-button-plugin';
import type { DetailPagePlugin } from './detail-page-plugin';
import type { FavoriteActressesPlugin } from './favorite-actresses-plugin';
import type { Fc2By123AvPlugin } from './fc2-by-123av-plugin';
import type { Fc2Plugin } from './fc2-plugin';
import type { FoldCategoryPlugin } from './fold-category-plugin';
import type { HighlightMagnetPlugin } from './highlight-magnet-plugin';
import type { HistoryPlugin } from './history-plugin';
import type { HitShowPlugin } from './hit-show-plugin';
import type { ImageRecognitionPlugin } from './image-recognition-plugin';
import type { KeyPageTurningPlugin } from './key-page-turning-plugin';
import type { ListPageButtonPlugin } from './list-page-button-plugin';
import type { ListPagePlugin } from './list-page-plugin';
import type { ListReadingStatusPlugin } from './list-reading-status-plugin';
import type { ListWaterfallPlugin } from './list-waterfall-plugin';
import type { MagnetHubPlugin } from './magnet-hub-plugin';
import type { MissavQuickCopyPlugin } from './missav-quick-copy-plugin';
import type { ModalListDisablerPlugin } from './modal-list-disabler-plugin';
import type { ModMyListOpenWayPlugin } from './mod-my-list-open-way-plugin';
import type { NavBarPlugin } from './nav-bar-plugin';
import type { NewVideoPlugin } from './new-video-plugin';
import type { OtherSitePlugin } from './other-site-plugin';
import type { PageSortPlugin } from './page-sort-plugin';
import type { PreviewVideoPlugin } from './preview-video-plugin';
import type { RatingDisplayPlugin } from './rating-display/rating-display-plugin';
import type { RelatedPlugin } from './related-plugin';
import type { ReviewPlugin } from './review-plugin';
import type { ScreenShotPlugin } from './screenshot-plugin';
import type { SettingPlugin } from './setting-plugin';
import type { StatusTagFilterPlugin } from './status-tag-filter-plugin';
import type { Top250Plugin } from './top250-plugin';
import type { TranslatePlugin } from './translate-plugin';
import type { VisitHistoryPlugin } from './visit-history-plugin';
import type { WantAndWatchedVideosPlugin } from './want-and-watched-videos-plugin';
import type { CarListReaderPlugin } from './car-status-sync/car-list-reader-plugin';
import type { MissavStatusTagPlugin } from './car-status-sync/missav-status-tag-plugin';
import type { VideoListsTagPlugin } from './video-lists-tag/vlt-plugin';

/** 插件名 → 插件类映射（getName() 返回值为键） */
export interface PluginMap {
    ActressInfoPlugin: ActressInfoPlugin;
    AutoPagePlugin: AutoPagePlugin;
    BlacklistPlugin: BlacklistPlugin;
    CarListReaderPlugin: CarListReaderPlugin;
    DetailPageButtonPlugin: DetailPageButtonPlugin;
    DetailPagePlugin: DetailPagePlugin;
    FavoriteActressesPlugin: FavoriteActressesPlugin;
    Fc2By123AvPlugin: Fc2By123AvPlugin;
    Fc2Plugin: Fc2Plugin;
    FoldCategoryPlugin: FoldCategoryPlugin;
    HighlightMagnetPlugin: HighlightMagnetPlugin;
    HistoryPlugin: HistoryPlugin;
    HitShowPlugin: HitShowPlugin;
    ImageRecognitionPlugin: ImageRecognitionPlugin;
    KeyPageTurningPlugin: KeyPageTurningPlugin;
    ListPageButtonPlugin: ListPageButtonPlugin;
    ListPagePlugin: ListPagePlugin;
    ListReadingStatusPlugin: ListReadingStatusPlugin;
    ListWaterfallPlugin: ListWaterfallPlugin;
    MagnetHubPlugin: MagnetHubPlugin;
    MissavQuickCopyPlugin: MissavQuickCopyPlugin;
    MissavStatusTagPlugin: MissavStatusTagPlugin;
    ModalListDisablerPlugin: ModalListDisablerPlugin;
    ModMyListOpenWayPlugin: ModMyListOpenWayPlugin;
    NavBarPlugin: NavBarPlugin;
    NewVideoPlugin: NewVideoPlugin;
    OtherSitePlugin: OtherSitePlugin;
    PageSortPlugin: PageSortPlugin;
    PreviewVideoPlugin: PreviewVideoPlugin;
    RatingDisplayPlugin: RatingDisplayPlugin;
    RelatedPlugin: RelatedPlugin;
    ReviewPlugin: ReviewPlugin;
    ScreenShotPlugin: ScreenShotPlugin;
    SettingPlugin: SettingPlugin;
    StatusTagFilterPlugin: StatusTagFilterPlugin;
    Top250Plugin: Top250Plugin;
    TranslatePlugin: TranslatePlugin;
    VideoListsTagPlugin: VideoListsTagPlugin;
    VisitHistoryPlugin: VisitHistoryPlugin;
    WantAndWatchedVideosPlugin: WantAndWatchedVideosPlugin;
}
