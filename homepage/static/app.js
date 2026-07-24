const WEATHER_CODES = {
  0: ["맑음", "☀️", "🌙"],
  1: ["대체로 맑음", "🌤️", "🌙"],
  2: ["구름 조금", "⛅", "☁️"],
  3: ["흐림", "☁️", "☁️"],
  45: ["안개", "🌫️", "🌫️"],
  48: ["짙은 안개", "🌫️", "🌫️"],
  51: ["약한 이슬비", "🌦️", "🌦️"],
  53: ["이슬비", "🌦️", "🌦️"],
  55: ["강한 이슬비", "🌦️", "🌦️"],
  56: ["어는 이슬비", "🌧️", "🌧️"],
  57: ["강한 어는 이슬비", "🌧️", "🌧️"],
  61: ["약한 비", "🌧️", "🌧️"],
  63: ["비", "🌧️", "🌧️"],
  65: ["강한 비", "🌧️", "🌧️"],
  66: ["어는 비", "🌧️", "🌧️"],
  67: ["강한 어는 비", "🌧️", "🌧️"],
  71: ["약한 눈", "🌨️", "🌨️"],
  73: ["눈", "🌨️", "🌨️"],
  75: ["강한 눈", "🌨️", "🌨️"],
  77: ["싸락눈", "🌨️", "🌨️"],
  80: ["약한 소나기", "🌦️", "🌦️"],
  81: ["소나기", "🌦️", "🌦️"],
  82: ["강한 소나기", "⛈️", "⛈️"],
  85: ["약한 눈 소나기", "🌨️", "🌨️"],
  86: ["강한 눈 소나기", "🌨️", "🌨️"],
  95: ["뇌우", "⛈️", "⛈️"],
  96: ["우박 동반 뇌우", "⛈️", "⛈️"],
  99: ["강한 우박 동반 뇌우", "⛈️", "⛈️"],
};

const DEFAULT_LOCATION = { latitude: 37.5665, longitude: 126.978, label: "서울" };

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeWeather(code, isDay) {
  const entry = WEATHER_CODES[code];
  if (!entry) return { label: "알 수 없음", icon: "🌡️" };
  const [label, dayIcon, nightIcon] = entry;
  return { label, icon: isDay ? dayIcon : nightIcon };
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("clock").textContent = `${hh}:${mm}:${ss}`;

  document.getElementById("date").textContent = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const hour = now.getHours();
  let greeting = "안녕하세요";
  if (hour < 6) greeting = "늦은 밤이네요";
  else if (hour < 12) greeting = "좋은 아침이에요";
  else if (hour < 18) greeting = "활기찬 오후 보내세요";
  else greeting = "편안한 저녁 되세요";
  document.getElementById("greeting").textContent = greeting;
}

function getLocation() {
  const geolocated = new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ ...DEFAULT_LOCATION, isDefault: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: null,
          isDefault: false,
        });
      },
      () => resolve({ ...DEFAULT_LOCATION, isDefault: true }),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 }
    );
  });

  // Some browsers never invoke either geolocation callback when a permission
  // prompt is left unanswered, so the built-in `timeout` option above can't
  // be relied on alone — race it against our own fallback.
  const fallback = new Promise((resolve) => {
    setTimeout(() => resolve({ ...DEFAULT_LOCATION, isDefault: true }), 6000);
  });

  return Promise.race([geolocated, fallback]);
}

async function resolveLocationLabel(latitude, longitude) {
  try {
    const res = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`,
      {},
      5000
    );
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    return data.city || data.locality || data.principalSubdivision || "내 위치";
  } catch {
    return "내 위치";
  }
}

function renderWeather(container, { label, icon, temp, description, feelsLike, max, min, humidity, wind }) {
  container.innerHTML = "";

  const locationEl = document.createElement("div");
  locationEl.className = "weather-location";
  locationEl.textContent = label;

  const main = document.createElement("div");
  main.className = "weather-main";

  const iconEl = document.createElement("span");
  iconEl.className = "weather-icon";
  iconEl.textContent = icon;

  const info = document.createElement("div");
  const tempEl = document.createElement("div");
  tempEl.className = "weather-temp";
  tempEl.textContent = `${temp}°C`;
  const descEl = document.createElement("div");
  descEl.className = "weather-desc";
  descEl.textContent = `${description} · 체감 ${feelsLike}°C`;
  info.append(tempEl, descEl);
  main.append(iconEl, info);

  const meta = document.createElement("div");
  meta.className = "weather-meta";
  for (const [labelText, value] of [
    ["최고", `${max}°C`],
    ["최저", `${min}°C`],
    ["습도", `${humidity}%`],
    ["바람", `${wind}km/h`],
  ]) {
    const span = document.createElement("span");
    span.append(`${labelText} `);
    const strong = document.createElement("strong");
    strong.textContent = value;
    span.appendChild(strong);
    meta.appendChild(span);
  }

  container.append(locationEl, main, meta);
}

async function loadWeather() {
  const body = document.getElementById("weather-body");
  try {
    const location = await getLocation();
    const label = location.isDefault
      ? location.label
      : await resolveLocationLabel(location.latitude, location.longitude);

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", location.latitude);
    url.searchParams.set("longitude", location.longitude);
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day"
    );
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
    url.searchParams.set("timezone", "auto");

    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`weather request failed: ${res.status}`);
    const data = await res.json();

    const current = data.current;
    const { label: weatherLabel, icon } = describeWeather(current.weather_code, current.is_day);

    renderWeather(body, {
      label,
      icon,
      temp: Math.round(current.temperature_2m),
      description: weatherLabel,
      feelsLike: Math.round(current.apparent_temperature),
      max: Math.round(data.daily.temperature_2m_max[0]),
      min: Math.round(data.daily.temperature_2m_min[0]),
      humidity: Math.round(current.relative_humidity_2m),
      wind: Math.round(current.wind_speed_10m),
    });
  } catch (err) {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "status";
    p.textContent = "날씨 정보를 불러오지 못했습니다.";
    body.appendChild(p);
    console.error(err);
  }
}

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const minutes = Math.round((Date.now() - timestamp * 1000) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

async function loadNews() {
  const body = document.getElementById("news-body");
  try {
    const res = await fetchWithTimeout("/api/news", {}, 10000);
    if (!res.ok) throw new Error(`news request failed: ${res.status}`);
    const data = await res.json();

    const items = (data.items || []).filter((item) => /^https?:\/\//i.test(item.link));
    if (items.length === 0) {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "status";
      p.textContent = "지금은 뉴스를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.";
      body.appendChild(p);
      return;
    }

    const list = document.createElement("ul");
    list.className = "news-list";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "news-item";

      const a = document.createElement("a");
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const source = document.createElement("span");
      source.className = "news-source";
      source.textContent = item.source;

      const title = document.createElement("span");
      title.className = "news-title";
      title.textContent = item.title;

      const timeEl = document.createElement("span");
      timeEl.className = "news-time";
      timeEl.textContent = timeAgo(item.published_ts);

      a.append(source, title, timeEl);
      li.appendChild(a);
      list.appendChild(li);
    }
    body.innerHTML = "";
    body.appendChild(list);
  } catch (err) {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "status";
    p.textContent = "뉴스를 불러오지 못했습니다.";
    body.appendChild(p);
    console.error(err);
  }
}

updateClock();
setInterval(updateClock, 1000);
loadWeather();
loadNews();
setInterval(loadWeather, 10 * 60 * 1000);
setInterval(loadNews, 10 * 60 * 1000);
