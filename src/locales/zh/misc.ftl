server-name = [服务器: {$server}]

players-top-scores = 玩家 {$player_name} 的最佳成绩
players-recent-score = 玩家 {$player_name} 的最近游玩

best-scores-header = 最高分
best-scores-subheader = 玩家 {$player_name} 于 {$date}

map-leaderboard-header = 本群组谱面排行榜:
nobody-played-this-map = 还没有人在此谱面上取得成绩!

unknown-game-mode-error = 发生错误: 未知游戏模式!

mode-set-not-specified =
    未指定模式!
    用法: {$prefix} mode <模式>
    可用模式:

mode-set-invalid =
    无效模式!
    可用模式:

game-mode-set = 模式设置成功!

search-not-specified = 请输入搜索内容
search-not-found = 未找到任何已排名谱面
search-result-header = 搜索结果:

not-found-scores-with-mod-combo = 未找到使用指定Mod组合的成绩!
near-pp-score = 玩家最接近 {$pp}pp 的成绩
top-n-score = 玩家第 #{$place} 名的成绩
max-page-error = 页码不存在，总页数: {$pages}
score-count = 玩家 {$player_name} 有{ $count ->
[one] {$count}个成绩
*[other] {$count}个成绩
}超过 {$pp} pp

nickname-set = 用户名设置成功
user-id-set = 用户ID设置成功
user-not-found =
    用户不存在!
nickname-not-specified =
    未指定用户名!
    用法: {$prefix} nick <用户名>
user-id-not-specified =
    未指定用户ID!
    用法: {$prefix} id <ID>

user-nickname-not-specified =
    该用户未设置用户名!
        请使用 {$prefix} nick <用户名> 绑定

sender-nickname-not-specified =
    未设置用户名!
    请使用 {$prefix} nick <用户名> 绑定

link-code-not-specified-with-url =
    请输入绑定码!
    打开: {$url}
    然后发送: {$prefix} link <code>

link-code-invalid =
    绑定码无效或已过期!
    打开: {$url}
    然后发送: {$prefix} link <code>

link-service-unavailable = 绑定服务暂时不可用，请稍后再试。
link-restricted-warning = 注意：你的 osu! 账号已被限制，部分功能可能不可用。

unknown-username = 该用户不在机器人的识别范围内！

specify-nickname = 请输入用户名!
no-users-found-nickname-find = 未找到使用该用户名的玩家!
users-with-nickname-find = 使用'{$nickname}'用户名的玩家

command-for-chats-only = 此命令仅限群组使用!
send-beatmap-first = 请先发送谱面!

best-players-score-on-this-beatmap = 玩家在此谱面的最佳成绩

chat-id-invalid = 无效群组ID!
give-chat-id = 请输入群组ID!
top-15-of-chat = 群组TOP15排行榜

osutrack-detailed-data-url = 查看详细数据：{$url}
osutrack-new-highscores = { $count ->
[0] 无新高分记录
[one] {$count} 个新高分记录
*[other] {$count} 个新高分记录
}
osutrack-and-scores-more = 以及另外 { $count ->
[one] {$count} 个成绩
*[other] {$count} 个成绩
}...
osutrack-rank-pp = 排名：{$rank}（{$pp} pp）｜游戏次数：{$playcount} 次

weather-city-required = 请指定城市！
weather-city-not-found = 未找到城市 "{$city}"！
weather-error = 获取天气数据失败，请稍后再试。
weather-output =
    📍 {$city}
    🌡 现在：{$temp}°C
    🤗 体感：{$feels}°C
    ☁️ 天气：{$desc}
    💧 湿度：{$humidity}%
    💨 风速：{$wind} m/s
    🕒 未来时段：
    {$hour1} — {$temp1}°C
    {$hour2} — {$temp2}°C
    {$hour3} — {$temp3}°C
    📅 预报：
    明天 — {$day1}°C
    后天 — {$day2}°C
    3天后 — {$day3}°C

lang-set = 语言已更改为 {$lang}
lang-usage = 请指定语言：!lang ru / en / zh / auto

source-no-image = 请回复照片或使用 !source 命令并附带照片
source-result =
    🔍 以图搜图：
    Yandex：{$yandex}
    Google：{$google}
    TinEye：{$tineye}

city-set = 默认城市已设置为 {$city}
city-current = 默认城市：{$city}
city-none = 尚未设置默认城市。请使用 !city <名称> 进行设置。

wmo-0 = 晴天
wmo-1 = 大部晴朗
wmo-2 = 局部多云
wmo-3 = 阴天
wmo-45 = 雾
wmo-48 = 雾凇
wmo-51 = 小毛毛雨
wmo-53 = 中毛毛雨
wmo-55 = 大毛毛雨
wmo-56 = 小冻毛毛雨
wmo-57 = 大冻毛毛雨
wmo-61 = 小雨
wmo-63 = 中雨
wmo-65 = 大雨
wmo-66 = 小冻雨
wmo-67 = 大冻雨
wmo-71 = 小雪
wmo-73 = 中雪
wmo-75 = 大雪
wmo-77 = 雪粒
wmo-80 = 小阵雨
wmo-81 = 中阵雨
wmo-82 = 大阵雨
wmo-85 = 小阵雪
wmo-86 = 大阵雪
wmo-95 = 雷暴
wmo-96 = 雷暴伴小冰雹
wmo-99 = 雷暴伴大冰雹
