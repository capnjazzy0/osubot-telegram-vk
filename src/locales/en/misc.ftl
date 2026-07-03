server-name = [Server: {$server}]

players-top-scores = {$player_name}'s top scores
players-recent-score = {$player_name}'s recent score

best-scores-header = Top Scores
best-scores-subheader = by {$player_name} on {$date}

map-leaderboard-header = Chat leaderboard for this map:
nobody-played-this-map = No one has scores on this map yet!

unknown-game-mode-error = Error: Unknown game mode!

mode-set-not-specified =
    No game mode specified!
    Usage: {$prefix} mode <mode>
    Available game modes:

mode-set-invalid =
    Invalid game mode!
    Available game modes:

game-mode-set = Game mode set!

search-not-specified = Please specify a search query
search-not-found = No ranked beatmaps found
search-result-header = Search results:

use-id-command-instead-of-nick = Для этого лидерборда недоступна установка никнейма!\nУстановите свой id, используя {$prefix} id <id>

not-found-scores-with-mod-combo = No top scores found with this mod combination!
near-pp-score = Player's closest score to {$pp}pp
top-n-score = Player's top #{$place} Score
max-page-error = Invalid page. Max pages: {$pages}
score-count = Player {$player_name} has { $count ->
    [one] {$count} score
    *[other] {$count} scores
} above {$pp}pp

nickname-set = Nickname set
user-id-set = Id set
user-not-found = User doesn't exist!
nickname-not-specified =
    No username specified!
    Usage: {$prefix} nick <username>
user-id-not-specified =
    No ID specified!
    Usage: {$prefix} id <user_id>

user-nickname-not-specified =
    This user doesn't have a nickname set!
    Set one using: {$prefix} nick <username>

sender-nickname-not-specified =
    No nickname specified!
    Set yours using: {$prefix} nick <username>

link-code-not-specified-with-url =
    Please provide a link code.
    Open: {$url}
    Then send: {$prefix} link <code>

link-code-invalid =
    Invalid or expired link code.
    Open: {$url}
    Then send: {$prefix} link <code>
link-service-unavailable = Link service is temporarily unavailable. Please try again later.
link-restricted-warning = Warning: your osu! account is restricted. Some features may be unavailable.

unknown-username = This user is unknown to the bot!

specify-nickname = Please, specify the nickname!
no-users-found-nickname-find = No users found with this username!
users-with-nickname-find = Users with username '{$nickname}'

command-for-chats-only = This command only works in group chats!
send-beatmap-first = Please send the beatmap first!

best-players-score-on-this-beatmap = Player's best score on this beatmap

chat-id-invalid = Invalid ID!
give-chat-id = Please provide the chat ID!
top-15-of-chat = Chat Top 15

osutrack-detailed-data-url = View detailed data here: {$url}
osutrack-new-highscores = { $count ->
    [0] No new highscores
    [one] {$count} new highscore
    *[other] {$count} new highscores
}
osutrack-and-scores-more = and { $count ->
    [one] {$count} score
    *[other] {$count} scores
} more...
osutrack-rank-pp = Rank: {$rank} ({$pp} pp) in {$playcount ->
    [one] {$playcount} play
    *[other] {$playcount} plays
}

weather-city-required = Specify a city!
weather-city-not-found = City "{$city}" not found!
weather-error = Failed to get weather data. Try again later.
weather-output =
    📍 {$city}
    🌡 Now: {$temp}°C
    🤗 Feels like: {$feels}°C
    ☁️ Weather: {$desc}
    💧 Humidity: {$humidity}%
    💨 Wind: {$wind} m/s
    🕒 Next hours:
    {$hour1} — {$temp1}°C
    {$hour2} — {$temp2}°C
    {$hour3} — {$temp3}°C
    📅 Forecast:
    Tomorrow — {$day1}°C
    Day after — {$day2}°C
    In 3 days — {$day3}°C

lang-set = Language changed to {$lang}
lang-usage = Specify a language: !lang ru / en / zh / auto

city-set = Default city set to {$city}
city-current = Default city: {$city}
city-none = No default city set. Use !city <name> to set one.

wmo-0 = Clear sky
wmo-1 = Mainly clear
wmo-2 = Partly cloudy
wmo-3 = Overcast
wmo-45 = Foggy
wmo-48 = Depositing rime fog
wmo-51 = Light drizzle
wmo-53 = Moderate drizzle
wmo-55 = Dense drizzle
wmo-56 = Light freezing drizzle
wmo-57 = Dense freezing drizzle
wmo-61 = Slight rain
wmo-63 = Moderate rain
wmo-65 = Heavy rain
wmo-66 = Light freezing rain
wmo-67 = Heavy freezing rain
wmo-71 = Slight snow
wmo-73 = Moderate snow
wmo-75 = Heavy snow
wmo-77 = Snow grains
wmo-80 = Slight rain showers
wmo-81 = Moderate rain showers
wmo-82 = Violent rain showers
wmo-85 = Slight snow showers
wmo-86 = Heavy snow showers
wmo-95 = Thunderstorm
wmo-96 = Thunderstorm with slight hail
wmo-99 = Thunderstorm with heavy hail
