// KK / RU / EN copy.
// Base: biletflow_web dictionaries (src/locales/*.js, synced by tools/sync-web-locales.mjs), so every
// shared screen uses the web wording. The objects below add mobile-only strings (scanner, tabs, ...).
import webEn from "./locales/en.js";
import webRu from "./locales/ru.js";
import webKk from "./locales/kk.js";

export const LANGUAGES = ["kk", "ru", "en"];
export const DEFAULT_LANG = "ru";
export const SPEECH_LOCALE = { kk: "kk-KZ", ru: "ru-RU", en: "en-US" };

const en = {
  nav: { events: "Events", logout: "Log out", hello: "Hi, {{name}}", back: "← Back to events" },
  roles: { event_admin: "Event admin", organizer: "Organizer", platform_admin: "Platform admin", admin: "Platform admin" },
  access: { owner: "Your event", staff: "Assigned", admin: "Platform admin" },
  common: { loading: "Loading…", cancel: "Cancel", retry: "Try again", close: "Close", dateTBA: "Date to be announced" },
  dates: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    card: "{{day}} {{monthShort}} {{year}}, {{time}}"
  },
  auth: {
    loginTitle: "Log in to BiletFlow",
    subtitle: "Check-in app for organizers and event staff",
    email: "Email",
    password: "Password",
    login: "Log in",
    loggingIn: "Logging in...",
    forgot: "Forgot password?",
    fillAll: "Fill in all fields.",
    sessionExpired: "Your session has expired. Please sign in again.",
    signedOut: "You have signed out. Data from this account was removed from the device.",
    staffOnly: "Only organizers and assigned event staff can use this app. Attendees sign in on the website.",
    errors: {
      BAD_CREDENTIALS: "Wrong email or password.",
      NOT_CONFIRMED: "Your email is not confirmed yet. Check your inbox.",
      SUSPENDED: "This account has been suspended by an administrator.",
      SERVICE: "The sign-in service is unavailable. Try again later.",
      TOO_MANY: "Too many requests. Wait a minute and try again.",
      NETWORK: "No connection to the server. Check Wi-Fi or mobile data and try again.",
      NOT_STAFF: "This account is not an organizer or event staff. Ask the organizer to assign you to the event."
    }
  },
  events: {
    title: "Your events",
    hintOrganizer: "Events you organize and events you are assigned to.",
    hintStaff: "Only events the organizer assigned to you are shown.",
    hintAdmin: "Platform admin: all events.",
    search: "Search by title or venue",
    results: "Events found: {{count}}",
    empty: "No events assigned to you yet.",
    emptyHint: "Ask the organizer to add your email as event staff, then pull to refresh.",
    noMatch: "Nothing matches your search.",
    open: "Open check-in",
    offline: "Offline: showing events saved on this device. Scanning needs a connection.",
    loadFailed: "Could not load your events.",
    refresh: "Refresh"
  },
  event: {
    checkedIn: "Checked in",
    of: "of {{total}}",
    countsUnavailable: "Attendance counters unavailable",
    tabs: { scanner: "Scan QR", attendees: "Attendees", log: "Scan log" },
    status: {
      connecting: "Connecting…",
      synced: "Synced {{time}}",
      paused: "Paused in background",
      offline: "Offline — data may be outdated",
      failed: "Sync failed — data may be outdated"
    },
    staleWrites: "Check-in and undo are disabled until the data is synchronized again.",
    revoked: "Your access to this event was removed by the organizer. You can no longer scan or check in here.",
    backToEvents: "Back to events",
    unavailable: "This event is cancelled or no longer available."
  },
  scanner: {
    permissionTitle: "Camera access needed",
    permissionBody: "Allow camera access to scan ticket QR codes at this event.",
    permissionAllow: "Allow camera",
    permissionSettings: "Camera access is blocked. Enable it for BiletFlow in the device settings.",
    openSettings: "Open settings",
    ready: "Point the camera at the ticket QR code",
    readyHint: "Paper, grayscale and on-screen tickets all work. Scanning starts automatically.",
    checking: "Checking ticket…",
    next: "Scan next ticket",
    undo: "Undo this check-in",
    latency: "Server response: {{ms}} ms",
    ticket: "Ticket {{id}}",
    disabled: "Scanning is paused while the app is in the background."
  },
  result: {
    CHECKED_IN: { title: "Valid — admitted", body: "Check-in recorded. Let the attendee in." },
    ALREADY_USED: { title: "Already used", body: "This ticket was already checked in. Do not admit again." },
    WRONG_EVENT: { title: "Wrong event", body: "This ticket is for a different event." },
    EXPIRED: { title: "Expired QR code", body: "This QR code has expired. Ask the attendee to open the current ticket." },
    INVALID_SIGNATURE: { title: "Invalid ticket", body: "The QR code is not a genuine BiletFlow ticket or was altered." },
    INVALID_FORMAT: { title: "Not a ticket", body: "This QR code is not a BiletFlow admission ticket." },
    CAMPAIGN_QR: { title: "Promo QR — not a ticket", body: "This is a campaign (promo code) QR. It gives a discount, not entry." },
    CANCELLED: { title: "Cancelled ticket", body: "This ticket was cancelled and is not valid." },
    REFUNDED: { title: "Refunded ticket", body: "This ticket was refunded and is not valid." },
    CANCELLED_OR_REFUNDED: { title: "Cancelled or refunded", body: "This ticket was cancelled or refunded and is not valid." },
    NOT_FOUND: { title: "Ticket not found", body: "No ticket with this ID exists on the platform." },
    INVALID: { title: "Not valid", body: "Entry not approved." },
    UNREADABLE: { title: "QR code unreadable", body: "The code did not contain any data. Try again." },
    OFFLINE: { title: "No connection — NOT admitted", body: "The ticket was not verified. Reconnect and scan again. If it then shows “Already used”, check the attendee list." },
    FORBIDDEN: { title: "No access to this event", body: "You are not assigned to check in this event." },
    ERROR: { title: "Could not verify", body: "Something went wrong. Try scanning again." },
    REVERSED: { title: "Check-in reversed", body: "The ticket is valid again and can be scanned." }
  },
  speech: {
    CHECKED_IN: "Valid", ALREADY_USED: "Already used", OFFLINE: "No connection",
    CAMPAIGN_QR: "Promo code, not a ticket", WRONG_EVENT: "Wrong event", REVERSED: "Check-in reversed", default: "Not valid"
  },
  attendees: {
    search: "Name, email or ticket ID",
    empty: "No attendees found.",
    unavailable: "Attendees unavailable. Pull to refresh.",
    checkedIn: "Checked in",
    notCheckedIn: "Not checked in",
    checkIn: "Check in",
    undo: "Undo check-in",
    saving: "Saving…",
    prev: "Previous",
    next: "Next",
    page: "Page {{page}}",
    ticket: "Ticket ID",
    confirmCheckIn: "Check in this attendee?",
    confirmUndo: "Undo this check-in?",
    confirmUndoBody: "The ticket becomes valid again. The reversal is recorded with your name and time.",
    done: "{{name}} is checked in.",
    reversed: "Check-in reversed for {{name}}.",
    alreadyUsed: "This ticket was already checked in (by another device?).",
    undoDenied: "The server denied the undo: your assignment does not allow it.",
    unknown: "The result is unknown because the connection dropped. Wait for synchronization and check the ticket status before trying again."
  },
  log: {
    title: "Scan timing (this session)",
    scans: "Timed scans",
    median: "Median",
    p95: "95th percentile",
    target: "Within 2 s",
    empty: "No scans yet. Results and server response times appear here.",
    share: "Share timing log",
    note: "Only online server checks are timed. Local rejections (promo QR, other event) are not sent to the server."
  }
};

const ru = {
  nav: { events: "Афиша", logout: "Выйти", hello: "Привет, {{name}}", back: "← К мероприятиям" },
  roles: { event_admin: "Администратор входа", organizer: "Организатор", platform_admin: "Администратор платформы", admin: "Администратор платформы" },
  access: { owner: "Ваше мероприятие", staff: "Назначено вам", admin: "Администратор платформы" },
  common: { loading: "Загрузка…", cancel: "Отмена", retry: "Повторить", close: "Закрыть", dateTBA: "Дата уточняется" },
  dates: {
    months: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    monthsShort: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    weekdays: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
    card: "{{day}} {{monthShort}} {{year}}, {{time}}"
  },
  auth: {
    loginTitle: "Вход в BiletFlow",
    subtitle: "Приложение для проверки билетов — для организаторов и персонала",
    email: "Email",
    password: "Пароль",
    login: "Войти",
    loggingIn: "Вход...",
    forgot: "Забыли пароль?",
    fillAll: "Заполните все поля.",
    sessionExpired: "Сессия истекла. Войдите снова.",
    signedOut: "Вы вышли. Данные этого аккаунта удалены с устройства.",
    staffOnly: "Приложением пользуются организаторы и назначенный персонал. Посетители входят на сайте.",
    errors: {
      BAD_CREDENTIALS: "Неверный email или пароль.",
      NOT_CONFIRMED: "Email ещё не подтверждён. Проверьте почту.",
      SUSPENDED: "Аккаунт заблокирован администратором.",
      SERVICE: "Сервис входа недоступен. Попробуйте позже.",
      TOO_MANY: "Слишком много запросов. Подождите минуту и попробуйте снова.",
      NETWORK: "Нет связи с сервером. Проверьте Wi-Fi или мобильный интернет и повторите.",
      NOT_STAFF: "Этот аккаунт не организатор и не персонал мероприятия. Попросите организатора назначить вас."
    }
  },
  events: {
    title: "Ваши мероприятия",
    hintOrganizer: "Мероприятия, которые вы организуете, и те, на которые вас назначили.",
    hintStaff: "Показаны только мероприятия, на которые вас назначил организатор.",
    hintAdmin: "Администратор платформы: все мероприятия.",
    search: "Поиск по названию или месту",
    results: "Найдено мероприятий: {{count}}",
    empty: "Вас пока не назначили ни на одно мероприятие.",
    emptyHint: "Попросите организатора добавить ваш email в персонал, затем обновите список.",
    noMatch: "По запросу ничего не найдено.",
    open: "Открыть проверку билетов",
    offline: "Нет сети: показаны мероприятия, сохранённые на устройстве. Для сканирования нужна связь.",
    loadFailed: "Не удалось загрузить мероприятия.",
    refresh: "Обновить"
  },
  event: {
    checkedIn: "Прошли",
    of: "из {{total}}",
    countsUnavailable: "Счётчик посещаемости недоступен",
    tabs: { scanner: "Сканер QR", attendees: "Посетители", log: "Журнал" },
    status: {
      connecting: "Подключение…",
      synced: "Синхронизировано {{time}}",
      paused: "Пауза в фоне",
      offline: "Нет сети — данные могут быть устаревшими",
      failed: "Ошибка синхронизации — данные могут быть устаревшими"
    },
    staleWrites: "Отметка и отмена входа недоступны, пока данные не синхронизируются.",
    revoked: "Организатор отозвал ваш доступ к этому мероприятию. Сканировать и отмечать вход здесь больше нельзя.",
    backToEvents: "К мероприятиям",
    unavailable: "Мероприятие отменено или недоступно."
  },
  scanner: {
    permissionTitle: "Нужен доступ к камере",
    permissionBody: "Разрешите доступ к камере, чтобы сканировать QR-коды билетов.",
    permissionAllow: "Разрешить камеру",
    permissionSettings: "Доступ к камере запрещён. Включите его для BiletFlow в настройках устройства.",
    openSettings: "Открыть настройки",
    ready: "Наведите камеру на QR-код билета",
    readyHint: "Подходят бумажные, чёрно-белые и электронные билеты. Сканирование начнётся само.",
    checking: "Проверяем билет…",
    next: "Сканировать следующий",
    undo: "Отменить этот вход",
    latency: "Ответ сервера: {{ms}} мс",
    ticket: "Билет {{id}}",
    disabled: "Сканирование на паузе, пока приложение в фоне."
  },
  result: {
    CHECKED_IN: { title: "Действителен — вход разрешён", body: "Вход отмечен. Пропустите посетителя." },
    ALREADY_USED: { title: "Уже использован", body: "По этому билету уже прошли. Повторно не пропускать." },
    WRONG_EVENT: { title: "Другое мероприятие", body: "Этот билет на другое мероприятие." },
    EXPIRED: { title: "QR-код истёк", body: "Срок действия QR-кода истёк. Попросите открыть актуальный билет." },
    INVALID_SIGNATURE: { title: "Недействительный билет", body: "QR-код не является подлинным билетом BiletFlow или был изменён." },
    INVALID_FORMAT: { title: "Это не билет", body: "Этот QR-код не является входным билетом BiletFlow." },
    CAMPAIGN_QR: { title: "Промо-QR — не билет", body: "Это QR рекламной кампании (промокод). Он даёт скидку, а не вход." },
    CANCELLED: { title: "Билет отменён", body: "Билет отменён и недействителен." },
    REFUNDED: { title: "Билет возвращён", body: "За билет оформлен возврат, он недействителен." },
    CANCELLED_OR_REFUNDED: { title: "Отменён или возвращён", body: "Билет отменён или возвращён и недействителен." },
    NOT_FOUND: { title: "Билет не найден", body: "Билета с таким ID нет на платформе." },
    INVALID: { title: "Недействителен", body: "Вход не разрешён." },
    UNREADABLE: { title: "QR-код не прочитан", body: "Код не содержит данных. Попробуйте ещё раз." },
    OFFLINE: { title: "Нет связи — вход НЕ разрешён", body: "Билет не проверен. Восстановите связь и отсканируйте снова. Если покажет «Уже использован», проверьте список посетителей." },
    FORBIDDEN: { title: "Нет доступа к мероприятию", body: "Вы не назначены на проверку билетов этого мероприятия." },
    ERROR: { title: "Не удалось проверить", body: "Что-то пошло не так. Отсканируйте ещё раз." },
    REVERSED: { title: "Вход отменён", body: "Билет снова действителен, его можно сканировать." }
  },
  speech: {
    CHECKED_IN: "Действителен", ALREADY_USED: "Уже использован", OFFLINE: "Нет связи",
    CAMPAIGN_QR: "Промокод, не билет", WRONG_EVENT: "Другое мероприятие", REVERSED: "Вход отменён", default: "Недействителен"
  },
  attendees: {
    search: "Имя, email или ID билета",
    empty: "Посетители не найдены.",
    unavailable: "Список недоступен. Потяните, чтобы обновить.",
    checkedIn: "Прошёл",
    notCheckedIn: "Не прошёл",
    checkIn: "Отметить вход",
    undo: "Отменить вход",
    saving: "Сохранение…",
    prev: "Назад",
    next: "Далее",
    page: "Страница {{page}}",
    ticket: "ID билета",
    confirmCheckIn: "Отметить вход посетителя?",
    confirmUndo: "Отменить этот вход?",
    confirmUndoBody: "Билет снова станет действительным. Отмена записывается с вашим именем и временем.",
    done: "{{name}}: вход отмечен.",
    reversed: "{{name}}: вход отменён.",
    alreadyUsed: "По этому билету уже прошли (возможно, на другом устройстве).",
    undoDenied: "Сервер отклонил отмену: ваше назначение этого не разрешает.",
    unknown: "Результат неизвестен: связь прервалась. Дождитесь синхронизации и проверьте статус билета, прежде чем повторять."
  },
  log: {
    title: "Время проверки (эта сессия)",
    scans: "Замеров",
    median: "Медиана",
    p95: "95-й процентиль",
    target: "До 2 с",
    empty: "Сканирований пока нет. Здесь появятся результаты и время ответа сервера.",
    share: "Поделиться журналом",
    note: "Замеряются только проверки на сервере. Локальные отказы (промо-QR, другое мероприятие) на сервер не отправляются."
  }
};

const kk = {
  nav: { events: "Афиша", logout: "Шығу", hello: "Сәлем, {{name}}", back: "← Іс-шараларға" },
  roles: { event_admin: "Кіру әкімшісі", organizer: "Ұйымдастырушы", platform_admin: "Платформа әкімшісі", admin: "Платформа әкімшісі" },
  access: { owner: "Сіздің іс-шараңыз", staff: "Сізге тағайындалған", admin: "Платформа әкімшісі" },
  common: { loading: "Жүктелуде…", cancel: "Болдырмау", retry: "Қайталау", close: "Жабу", dateTBA: "Күні кейін хабарланады" },
  dates: {
    months: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
    monthsShort: ["қаң.", "ақп.", "нау.", "сәу.", "мам.", "мау.", "шіл.", "там.", "қыр.", "қаз.", "қар.", "жел."],
    weekdays: ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"],
    card: "{{year}} ж. {{day}} {{monthShort}}, {{time}}"
  },
  auth: {
    loginTitle: "BiletFlow жүйесіне кіру",
    subtitle: "Билет тексеру қосымшасы — ұйымдастырушылар мен қызметкерлерге",
    email: "Email",
    password: "Құпиясөз",
    login: "Кіру",
    loggingIn: "Кіру...",
    forgot: "Құпиясөзді ұмыттыңыз ба?",
    fillAll: "Барлық өрістерді толтырыңыз.",
    sessionExpired: "Сессия аяқталды. Қайта кіріңіз.",
    signedOut: "Сіз шықтыңыз. Осы аккаунттың деректері құрылғыдан өшірілді.",
    staffOnly: "Қосымшаны ұйымдастырушылар мен тағайындалған қызметкерлер қолданады. Қатысушылар сайтқа кіреді.",
    errors: {
      BAD_CREDENTIALS: "Email немесе құпиясөз қате.",
      NOT_CONFIRMED: "Email әлі расталмаған. Поштаңызды тексеріңіз.",
      SUSPENDED: "Аккаунтты әкімші бұғаттады.",
      SERVICE: "Кіру қызметі қолжетімсіз. Кейінірек көріңіз.",
      TOO_MANY: "Сұраулар тым көп. Бір минут күтіп, қайталаңыз.",
      NETWORK: "Сервермен байланыс жоқ. Wi-Fi немесе мобильді интернетті тексеріп, қайталаңыз.",
      NOT_STAFF: "Бұл аккаунт ұйымдастырушы немесе іс-шара қызметкері емес. Ұйымдастырушыдан сізді тағайындауды сұраңыз."
    }
  },
  events: {
    title: "Сіздің іс-шараларыңыз",
    hintOrganizer: "Сіз ұйымдастыратын және сізге тағайындалған іс-шаралар.",
    hintStaff: "Тек ұйымдастырушы сізге тағайындаған іс-шаралар көрсетіледі.",
    hintAdmin: "Платформа әкімшісі: барлық іс-шаралар.",
    search: "Атауы немесе орны бойынша іздеу",
    results: "Табылған іс-шаралар: {{count}}",
    empty: "Сізге әлі ешбір іс-шара тағайындалмаған.",
    emptyHint: "Ұйымдастырушыдан email-іңізді қызметкерлерге қосуды сұраңыз, содан кейін тізімді жаңартыңыз.",
    noMatch: "Сұрау бойынша ештеңе табылмады.",
    open: "Билет тексеруді ашу",
    offline: "Желі жоқ: құрылғыда сақталған іс-шаралар көрсетілді. Сканерлеу үшін байланыс керек.",
    loadFailed: "Іс-шараларды жүктеу мүмкін болмады.",
    refresh: "Жаңарту"
  },
  event: {
    checkedIn: "Кірді",
    of: "{{total}} ішінен",
    countsUnavailable: "Қатысу есептегіші қолжетімсіз",
    tabs: { scanner: "QR сканер", attendees: "Қатысушылар", log: "Журнал" },
    status: {
      connecting: "Қосылуда…",
      synced: "Синхрондалды {{time}}",
      paused: "Фондағы үзіліс",
      offline: "Желі жоқ — деректер ескірген болуы мүмкін",
      failed: "Синхрондау қатесі — деректер ескірген болуы мүмкін"
    },
    staleWrites: "Деректер қайта синхрондалмайынша кіруді белгілеу және болдырмау өшірулі.",
    revoked: "Ұйымдастырушы бұл іс-шараға қолжетімділігіңізді алып тастады. Мұнда енді сканерлеуге болмайды.",
    backToEvents: "Іс-шараларға",
    unavailable: "Іс-шара болдырылмады немесе қолжетімсіз."
  },
  scanner: {
    permissionTitle: "Камераға рұқсат керек",
    permissionBody: "Билеттердің QR-кодтарын сканерлеу үшін камераға рұқсат беріңіз.",
    permissionAllow: "Камераға рұқсат беру",
    permissionSettings: "Камераға рұқсат жабық. Құрылғы баптауларында BiletFlow үшін қосыңыз.",
    openSettings: "Баптауларды ашу",
    ready: "Камераны билеттің QR-кодына бағыттаңыз",
    readyHint: "Қағаз, ақ-қара және электрондық билеттер жарайды. Сканерлеу өзі басталады.",
    checking: "Билет тексерілуде…",
    next: "Келесісін сканерлеу",
    undo: "Бұл кіруді болдырмау",
    latency: "Сервер жауабы: {{ms}} мс",
    ticket: "Билет {{id}}",
    disabled: "Қосымша фонда тұрғанда сканерлеу тоқтатылады."
  },
  result: {
    CHECKED_IN: { title: "Жарамды — кіруге болады", body: "Кіру белгіленді. Қатысушыны өткізіңіз." },
    ALREADY_USED: { title: "Қолданылған", body: "Бұл билетпен кіріп қойған. Қайта өткізбеңіз." },
    WRONG_EVENT: { title: "Басқа іс-шара", body: "Бұл билет басқа іс-шараға арналған." },
    EXPIRED: { title: "QR-кодтың мерзімі өтті", body: "QR-кодтың мерзімі өтті. Өзекті билетті ашуды сұраңыз." },
    INVALID_SIGNATURE: { title: "Жарамсыз билет", body: "QR-код түпнұсқа BiletFlow билеті емес немесе өзгертілген." },
    INVALID_FORMAT: { title: "Бұл билет емес", body: "Бұл QR-код BiletFlow кіру билеті емес." },
    CAMPAIGN_QR: { title: "Промо-QR — билет емес", body: "Бұл жарнамалық науқанның QR-коды (промокод). Ол кіруге емес, жеңілдікке арналған." },
    CANCELLED: { title: "Билет болдырылмады", body: "Билет болдырылмаған және жарамсыз." },
    REFUNDED: { title: "Билет қайтарылды", body: "Билет үшін ақша қайтарылды, ол жарамсыз." },
    CANCELLED_OR_REFUNDED: { title: "Болдырылмады немесе қайтарылды", body: "Билет болдырылмаған немесе қайтарылған, жарамсыз." },
    NOT_FOUND: { title: "Билет табылмады", body: "Платформада мұндай ID бар билет жоқ." },
    INVALID: { title: "Жарамсыз", body: "Кіруге рұқсат жоқ." },
    UNREADABLE: { title: "QR-код оқылмады", body: "Кодта дерек жоқ. Қайталап көріңіз." },
    OFFLINE: { title: "Байланыс жоқ — кіруге РҰҚСАТ ЖОҚ", body: "Билет тексерілмеді. Байланысты қалпына келтіріп, қайта сканерлеңіз. «Қолданылған» десе, қатысушылар тізімін тексеріңіз." },
    FORBIDDEN: { title: "Іс-шараға қолжетімділік жоқ", body: "Сіз бұл іс-шараның билеттерін тексеруге тағайындалмағансыз." },
    ERROR: { title: "Тексеру мүмкін болмады", body: "Бірдеңе дұрыс болмады. Қайта сканерлеңіз." },
    REVERSED: { title: "Кіру болдырылмады", body: "Билет қайта жарамды, оны сканерлеуге болады." }
  },
  speech: {
    CHECKED_IN: "Жарамды", ALREADY_USED: "Қолданылған", OFFLINE: "Байланыс жоқ",
    CAMPAIGN_QR: "Промокод, билет емес", WRONG_EVENT: "Басқа іс-шара", REVERSED: "Кіру болдырылмады", default: "Жарамсыз"
  },
  attendees: {
    search: "Аты, email немесе билет ID",
    empty: "Қатысушылар табылмады.",
    unavailable: "Тізім қолжетімсіз. Жаңарту үшін төмен тартыңыз.",
    checkedIn: "Кірді",
    notCheckedIn: "Кірмеді",
    checkIn: "Кіруді белгілеу",
    undo: "Кіруді болдырмау",
    saving: "Сақталуда…",
    prev: "Артқа",
    next: "Келесі",
    page: "{{page}}-бет",
    ticket: "Билет ID",
    confirmCheckIn: "Қатысушының кіруін белгілеу керек пе?",
    confirmUndo: "Бұл кіруді болдырмау керек пе?",
    confirmUndoBody: "Билет қайта жарамды болады. Болдырмау сіздің атыңызбен және уақытымен жазылады.",
    done: "{{name}}: кіру белгіленді.",
    reversed: "{{name}}: кіру болдырылмады.",
    alreadyUsed: "Бұл билетпен кіріп қойған (басқа құрылғыда болуы мүмкін).",
    undoDenied: "Сервер болдырмауды қабылдамады: тағайындауыңыз бұған рұқсат бермейді.",
    unknown: "Байланыс үзілгендіктен нәтиже белгісіз. Синхрондауды күтіп, қайталамас бұрын билет күйін тексеріңіз."
  },
  log: {
    title: "Тексеру уақыты (осы сессия)",
    scans: "Өлшемдер",
    median: "Медиана",
    p95: "95-перцентиль",
    target: "2 с дейін",
    empty: "Әзірге сканерлеу жоқ. Мұнда нәтижелер мен сервер жауабының уақыты шығады.",
    share: "Журналды бөлісу",
    note: "Тек сервердегі тексерулер өлшенеді. Жергілікті бас тартулар (промо-QR, басқа іс-шара) серверге жіберілмейді."
  }
};

// Mobile-only additions for the full app (tabs, account, file sharing, date picker).
const extra = {
  en: {
    staff: { tab: "Check-in staff", hint: "Staff assigned here can sign in to the mobile app and scan tickets for this event only. Removing someone blocks their scanner at once.", empty: "No staff assigned yet.", email: "Staff member email (existing account)", add: "Assign", added: "Staff member assigned.", removed: "Staff member removed.", remove: "Remove", confirmRemove: "Remove {{name}} from check-in for this event?", emailRequired: "Enter an email.", notFound: "No account with this email.", failed: "Could not update staff: {{reason}}" },
    tabs: { events: "Events", tickets: "Orders", checkin: "Scan", organizer: "Organizer", support: "Support", account: "Account" },
    account: {
      title: "Account", language: "Language", guestTitle: "Sign in to buy tickets, see your orders and contact support.",
      signup: "Create an account", login: "Log in", profile: "Edit profile", staffHint: "Open the Scan tab to check tickets at the door."
    },
    files: { shareFailed: "Could not open the file: {{reason}}", calendarHint: "Choose Calendar in the share sheet to add the event." },
    picker: { choose: "Choose…", clear: "Clear", done: "Done", formatHint: "YYYY-MM-DD HH:MM" },
    saleDates: { invalid: "Enter a valid date and time for {{field}} (YYYY-MM-DD HH:MM)." },
    misc: { refresh: "Refresh", openWeb: "Open on the website", loginRequired: "Log in to continue." }
  },
  ru: {
    staff: { tab: "Персонал входа", hint: "Назначенные сотрудники входят в мобильное приложение и сканируют билеты только этого мероприятия. После удаления сканер сотрудника сразу блокируется.", empty: "Персонал пока не назначен.", email: "Email сотрудника (существующий аккаунт)", add: "Назначить", added: "Сотрудник назначен.", removed: "Сотрудник удалён.", remove: "Удалить", confirmRemove: "Убрать {{name}} из проверки билетов этого мероприятия?", emailRequired: "Введите email.", notFound: "Аккаунт с таким email не найден.", failed: "Не удалось изменить персонал: {{reason}}" },
    tabs: { events: "Афиша", tickets: "Заказы", checkin: "Сканер", organizer: "Кабинет", support: "Помощь", account: "Профиль" },
    account: {
      title: "Аккаунт", language: "Язык", guestTitle: "Войдите, чтобы покупать билеты, видеть заказы и писать в поддержку.",
      signup: "Создать аккаунт", login: "Войти", profile: "Редактировать профиль", staffHint: "Откройте вкладку «Сканер», чтобы проверять билеты на входе."
    },
    files: { shareFailed: "Не удалось открыть файл: {{reason}}", calendarHint: "Выберите «Календарь» в меню, чтобы добавить событие." },
    picker: { choose: "Выбрать…", clear: "Очистить", done: "Готово", formatHint: "ГГГГ-ММ-ДД ЧЧ:ММ" },
    saleDates: { invalid: "Укажите корректные дату и время в поле «{{field}}» (ГГГГ-ММ-ДД ЧЧ:ММ)." },
    misc: { refresh: "Обновить", openWeb: "Открыть на сайте", loginRequired: "Войдите, чтобы продолжить." }
  },
  kk: {
    staff: { tab: "Кіру қызметкерлері", hint: "Тағайындалған қызметкерлер мобильді қосымшаға кіріп, тек осы іс-шараның билеттерін сканерлейді. Алып тастағанда сканері бірден бұғатталады.", empty: "Қызметкерлер әлі тағайындалмаған.", email: "Қызметкердің email-і (бар аккаунт)", add: "Тағайындау", added: "Қызметкер тағайындалды.", removed: "Қызметкер алып тасталды.", remove: "Алып тастау", confirmRemove: "{{name}} осы іс-шараның билет тексеруінен алынсын ба?", emailRequired: "Email енгізіңіз.", notFound: "Мұндай email-мен аккаунт табылмады.", failed: "Қызметкерлерді өзгерту мүмкін болмады: {{reason}}" },
    tabs: { events: "Афиша", tickets: "Тапсырыс", checkin: "Сканер", organizer: "Кабинет", support: "Көмек", account: "Профиль" },
    account: {
      title: "Аккаунт", language: "Тіл", guestTitle: "Билет сатып алу, тапсырыстарды көру және қолдауға жазу үшін кіріңіз.",
      signup: "Аккаунт ашу", login: "Кіру", profile: "Профильді өзгерту", staffHint: "Кіреберісте билеттерді тексеру үшін «Сканер» қойындысын ашыңыз."
    },
    files: { shareFailed: "Файлды ашу мүмкін болмады: {{reason}}", calendarHint: "Іс-шараны қосу үшін мәзірден «Күнтізбе» таңдаңыз." },
    picker: { choose: "Таңдау…", clear: "Тазалау", done: "Дайын", formatHint: "ЖЖЖЖ-АА-КК СС:ММ" },
    saleDates: { invalid: "«{{field}}» өрісіне жарамды күн мен уақытты енгізіңіз (ЖЖЖЖ-АА-КК СС:ММ)." },
    misc: { refresh: "Жаңарту", openWeb: "Сайтта ашу", loginRequired: "Жалғастыру үшін кіріңіз." }
  }
};

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

// a wins on conflicts; b fills the gaps.
function mergePreferA(a, b) {
  const out = { ...b };
  for (const [key, value] of Object.entries(a || {})) {
    out[key] = isPlainObject(value) && isPlainObject(b?.[key]) ? mergePreferA(value, b[key]) : value;
  }
  return out;
}

const mobileEn = mergePreferA(extra.en, en);
const mobileRu = mergePreferA(extra.ru, ru);
const mobileKk = mergePreferA(extra.kk, kk);

/** Mobile-only strings (kept identical in key structure across languages; checked by tests). */
export const DICTIONARIES = { en: mobileEn, ru: mobileRu, kk: mobileKk };
/** What the app renders: web wording wins wherever the web defines the key. */
export const MERGED = {
  en: mergePreferA(webEn, mobileEn),
  ru: mergePreferA(webRu, mobileRu),
  kk: mergePreferA(webKk, mobileKk)
};
export const LOCALES = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" };

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function pluralCategory(lang, count) {
  try { return new Intl.PluralRules(LOCALES[lang] || "en").select(count); } catch { /* old engines */ }
  if (lang === "ru") {
    const n10 = count % 10, n100 = count % 100;
    if (n10 === 1 && n100 !== 11) return "one";
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "few";
    return "many";
  }
  return count === 1 ? "one" : "other";
}

function resolve(lang, key, params) {
  // fallback chain like the web (fallbackLng: ru), then English
  for (const code of [lang, "ru", "en"]) {
    const dict = MERGED[code];
    if (!dict) continue;
    if (params && typeof params.count === "number") {
      const plural = lookup(dict, `${key}_${pluralCategory(code, params.count)}`) ?? lookup(dict, `${key}_other`);
      if (plural !== undefined) return plural;
    }
    const value = lookup(dict, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function translate(lang, key, params) {
  const value = resolve(MERGED[lang] ? lang : DEFAULT_LANG, key, params);
  if (typeof value !== "string") return value ?? (params?.defaultValue ?? key);
  return params ? value.replace(/\{\{(\w+)\}\}/g, (_, name) => (params[name] ?? "")) : value;
}

export function hasKey(lang, key) {
  return resolve(lang, key) !== undefined;
}

// Kazakhstan uses a single UTC+5 zone; used when Intl time zones are unavailable on the device.
const FALLBACK_OFFSET_MIN = 5 * 60;

function partsInZone(date, timeZone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      weekday: "short", hour: "2-digit", minute: "2-digit"
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    if (weekday < 0 || !parts.year) throw new Error("no tz data");
    return { year: parts.year, month: Number(parts.month) - 1, day: String(Number(parts.day)), weekday, time: `${parts.hour}:${parts.minute}` };
  } catch {
    const shifted = new Date(date.getTime() + FALLBACK_OFFSET_MIN * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return {
      year: String(shifted.getUTCFullYear()), month: shifted.getUTCMonth(), day: String(shifted.getUTCDate()),
      weekday: shifted.getUTCDay(), time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
    };
  }
}

/** Web formats: "card" (event cards) and "full" (details, tickets, orders), in the event's time zone. */
export function formatEventDate(lang, iso, timeZone = "Asia/Almaty", style = "card") {
  if (!iso) return translate(lang, "common.dateTBA");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return translate(lang, "common.dateTBA");
  const p = partsInZone(date, timeZone || "Asia/Almaty");
  return translate(lang, `dates.${style}`, {
    year: p.year, day: p.day, time: p.time,
    month: translate(lang, "dates.months")[p.month],
    monthShort: translate(lang, "dates.monthsShort")[p.month],
    weekday: translate(lang, "dates.weekdays")[p.weekday]
  });
}

/** Same as the web formatKZT: grouped digits + " ₸". */
export function formatKZT(lang, amount) {
  const n = Math.round(Number(amount) || 0);
  let digits;
  try { digits = new Intl.NumberFormat(LOCALES[lang] || "ru-RU").format(n); }
  catch { digits = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  return `${digits} ₸`;
}

export function formatClock(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDateTimeShort(lang, iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try { return date.toLocaleString(LOCALES[lang]); } catch { return date.toISOString(); }
}
