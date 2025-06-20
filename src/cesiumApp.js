import * as Cesium from "cesium";
// これまで作成した外部モジュールをインポート
import { getWeather } from "./weather.js";
import { getBusLocations } from "./transit.js";
import { getRoute } from "./routing.js";

// --- グローバル変数 ---
let weatherParticleSystem = null; // 天気エフェクトを管理
const busEntities = new Map(); // バス情報を管理
let restaurantPinEntities = []; // レストランのピンを管理
let routeEntity = null; // 表示中の経路を管理
let lastClickedCoordinates = null; // クリックした地点の座標を保持

// --- 天気関連の関数 ---
async function updateWeatherEffects(viewer) {
  const MINATO_KU_LAT = 35.658;
  const MINATO_KU_LON = 139.7516;
  const weather = await getWeather(MINATO_KU_LAT, MINATO_KU_LON);
  const widget = document.getElementById("weather-widget");
  if (!widget) return;

  if (weather) {
    widget.innerHTML = `
      <div class="flex items-center gap-2">
        <img src="${weather.iconUrl}" alt="${
      weather.description
    }" class="w-12 h-12">
        <div>
          <p class="font-bold text-lg">${weather.description}</p>
          <p class="text-sm">${weather.temperature.toFixed(1)} °C</p>
        </div>
      </div>
    `;
    widget.classList.remove("hidden");
  } else {
    widget.innerHTML = `<p>天気情報の取得に失敗</p>`;
    widget.classList.remove("hidden");
  }

  if (weatherParticleSystem)
    viewer.scene.primitives.remove(weatherParticleSystem);
  weatherParticleSystem = null;

  switch (weather?.condition) {
    case "Rain":
    case "Drizzle":
    case "Thunderstorm":
      viewer.scene.skyAtmosphere.hueShift = -0.97;
      viewer.scene.skyAtmosphere.saturationShift = -0.4;
      viewer.scene.skyAtmosphere.brightnessShift = -0.33;
      weatherParticleSystem = new Cesium.ParticleSystem({
        modelMatrix: Cesium.Matrix4.fromTranslation(viewer.camera.position),
        speed: -15.0,
        lifetime: 1.5,
        emitter: new Cesium.BoxEmitter(new Cesium.Cartesian3(0.0, 0.0, 100.0)),
        size: 5.0,
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAFUlEQVQYV2NkwAJuZmBgYMADgZ8GAHqXAx8+p32SAAAAAElFTkSuQmCC",
        emissionRate: 2000.0,
      });
      break;
    case "Snow":
      viewer.scene.skyAtmosphere.hueShift = -0.8;
      viewer.scene.skyAtmosphere.saturationShift = -0.7;
      viewer.scene.skyAtmosphere.brightnessShift = -0.33;
      weatherParticleSystem = new Cesium.ParticleSystem({
        modelMatrix: Cesium.Matrix4.fromTranslation(viewer.camera.position),
        speed: -1.0,
        lifetime: 15.0,
        emitter: new Cesium.BoxEmitter(new Cesium.Cartesian3(0.0, 0.0, 100.0)),
        size: 8.0,
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAKtJREFUOE9jZKAQMJKggb8/h9F/s4AowMvLyz8DPlW2wP/g/z8Bwy4YMWLEr4E2D0D8H4b/Gci4QYyJkQxMhP8f/v//AcP/6L8YMJDx//9/sIIXgqH/gUExiP8y/v//L6DiB6L//3/x/2cY/m/4f+EPg4H/B2L+D2L+D2I+ROGfMggUQ3p6Ov+DMiCSpqam/w9kXGEDs4AowMjISGACiAIAQpAxI2xASc4EALs5RST1rZJvAAAAAElFTkSuQmCC",
        emissionRate: 200.0,
        updateCallback: (p) => {
          p.position.x += Cesium.Math.randomBetween(-1.0, 1.0);
        },
      });
      break;
    default:
      viewer.scene.skyAtmosphere.hueShift = 0.0;
      viewer.scene.skyAtmosphere.saturationShift = 0.0;
      viewer.scene.skyAtmosphere.brightnessShift = 0.0;
      break;
  }
  if (weatherParticleSystem) viewer.scene.primitives.add(weatherParticleSystem);
}

// --- バス関連の関数 ---
async function updateBusEntities(viewer) {
  const busData = await getBusLocations();
  if (!busData) return;
  const visibleBusIds = new Set();
  busData.forEach((bus) => {
    visibleBusIds.add(bus.id);
    const position = Cesium.Cartesian3.fromDegrees(bus.lon, bus.lat, 20);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90 - bus.azimuth), 0, 0)
    );
    const existingBus = busEntities.get(bus.id);
    if (existingBus) {
      existingBus.position = position;
      existingBus.orientation = orientation;
    } else {
      const newBus = viewer.entities.add({
        id: bus.id,
        position,
        orientation,
        model: { uri: "/models/bus.glb", minimumPixelSize: 64 },
        label: {
          text: `[${bus.busNumber}]`,
          font: "12pt sans-serif",
          pixelOffset: new Cesium.Cartesian2(0, -50),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
        },
      });
      busEntities.set(bus.id, newBus);
    }
  });
  for (const [id, entity] of busEntities.entries()) {
    if (!visibleBusIds.has(id)) {
      viewer.entities.remove(entity);
      busEntities.delete(id);
    }
  }
}

// --- レストラン＆経路関連の関数 ---
function clearRestaurantPins(viewer) {
  restaurantPinEntities.forEach((entity) => viewer.entities.remove(entity));
  restaurantPinEntities = [];
}
function clearRoute(viewer) {
  if (routeEntity) {
    viewer.entities.remove(routeEntity);
    routeEntity = null;
  }
}
async function drawRoute(viewer, startCoords, endCoords) {
  clearRoute(viewer);
  const routeCoordinates = await getRoute(startCoords, endCoords);
  if (!routeCoordinates || routeCoordinates.length === 0) {
    alert("経路が見つかりませんでした。");
    return;
  }
  const positions = routeCoordinates.flat();
  routeEntity = viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(positions),
      width: 5,
      material: Cesium.Color.RED,
      clampToGround: true,
    },
  });
}

function showRestaurantPins(viewer, shops) {
  const pinBuilder = new Cesium.PinBuilder();
  const pinIconUrl = pinBuilder
    .fromColor(Cesium.Color.fromCssColorString("#FF5733"), 48)
    .toDataURL();
  shops.forEach((shop) => {
    const position = Cesium.Cartesian3.fromDegrees(shop.lng, shop.lat, 30);
    const pinEntity = viewer.entities.add({
      position,
      billboard: {
        image: pinIconUrl,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      },
      label: {
        text: shop.name,
        font: "12pt sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -55),
      },
      description: `<h3><a href="${shop.urls.pc}" target="_blank">${shop.name}</a></h3><p>${shop.catch}</p><p>ジャンル: ${shop.genre.name}</p><img src="${shop.photo.pc.m}" width="150">`,
    });
    restaurantPinEntities.push(pinEntity);
  });
}

async function fetchHotpepperData(lat, lng) {
  const apiKey = import.meta.env.VITE_HOTPEPPER_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({
    key: apiKey,
    lat,
    lng,
    range: 2,
    count: 10,
    order: 4,
    format: "json",
  });
  const url = `/api/hotpepper?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`APIエラー: ${response.status}`);
    const data = await response.json();
    return data.results?.shop || [];
  } catch (error) {
    console.error("ホットペッパーAPIの取得に失敗:", error);
    return [];
  }
}

function createDescriptionHtml(pickedFeature, shops) {
  let featureHtml = `<p>地物情報がありません</p>`;
  try {
    const keys = pickedFeature?.getPropertyIds?.() || [];
    const usageKeys = ["usage", "用途"];
    const getPropertySafely = (keys, candidates) => {
      const key = candidates.find((c) => keys.includes(c));
      return key ? pickedFeature.getProperty(key) : "";
    };
    const usage = getPropertySafely(keys, usageKeys);
    featureHtml = `${usage ? `<p><b>用途:</b> ${usage}</p>` : ""}`;
  } catch (e) {
    console.error("地物情報の処理中にエラー:", e);
  }

  let shopsHtml = "<h3><br>周辺の飲食店情報</h3>";
  if (shops?.length > 0) {
    shopsHtml += `<ul style="list-style:none; padding:0; margin-top:1em;">`;
    shopsHtml += shops
      .map(
        (shop) => `
      <li style="margin-bottom:1em; border-bottom:1px solid #eee; padding-bottom:1em;">
        <div style="display:flex; gap:1em; align-items:center;">
          <img src="${shop.photo.pc.s}" alt="${shop.name}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          <div style="flex:1;">
            <a href="${shop.urls.pc}" target="_blank" style="font-weight:bold;">${shop.name}</a>
            <p style="font-size:0.8em;">${shop.genre.name}</p>
          </div>
          <button class="route-button" data-lon="${shop.lng}" data-lat="${shop.lat}" style="padding:4px 8px; background-color:#1890ff; color:white; border:none; border-radius:4px; cursor:pointer;">経路</button>
        </div>
      </li>`
      )
      .join("");
    shopsHtml += `</ul>`;
  } else {
    shopsHtml += `<p>周辺に登録店舗は見つかりませんでした。</p>`;
  }
  return featureHtml + shopsHtml;
}

// --- メインのCesium初期化・実行関数 ---
export async function startCesium(containerId) {
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
  const viewer = new Cesium.Viewer(containerId, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
    infoBox: true,
  });

  // --- 各機能の呼び出し ---
  updateWeatherEffects(viewer);
  setInterval(() => updateWeatherEffects(viewer), 10 * 60 * 1000); // 10分ごとに天気更新
  updateBusEntities(viewer);
  setInterval(() => updateBusEntities(viewer), 30 * 1000); // 30秒ごとにバス位置更新

  // 3Dタイルセットの読み込み (代表的なものに絞り込み)
  const tileUrls = [
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2/tileset.json",
  ];
  try {
    const tilesets = await Promise.all(
      tileUrls.map((url) => Cesium.Cesium3DTileset.fromUrl(url))
    );
    tilesets.forEach((ts) => viewer.scene.primitives.add(ts));
    if (tilesets.length > 0) await viewer.zoomTo(tilesets[0]);
  } catch (error) {
    console.error("タイルセットの読み込みに失敗:", error);
  }

  // クリックイベントのハンドラ設定
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(async (click) => {
    clearRestaurantPins(viewer);
    clearRoute(viewer);
    const pickedFeature = viewer.scene.pick(click.position);
    const worldPosition = viewer.scene.pickPosition(click.position);
    if (!Cesium.defined(pickedFeature) || !Cesium.defined(worldPosition)) {
      viewer.selectedEntity = undefined;
      return;
    }
    const cartographic = Cesium.Cartographic.fromCartesian(worldPosition);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    lastClickedCoordinates = { lon: longitude, lat: latitude };
    const entityName = pickedFeature?.getProperty?.("名称") || "周辺情報";
    viewer.selectedEntity = new Cesium.Entity({
      name: entityName,
      description: "周辺情報を検索中...",
    });
    const shops = await fetchHotpepperData(latitude, longitude);
    viewer.selectedEntity.description = createDescriptionHtml(
      pickedFeature,
      shops
    );
    showRestaurantPins(viewer, shops);
    viewer.scene.requestRender();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
  // 以下を修正・変更
  // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

  // selectedEntityが変わった時のイベントリスナー
  viewer.selectedEntityChanged.addEventListener(() => {
    // InfoBoxが閉じた（エンティティの選択が解除された）時の処理
    if (!Cesium.defined(viewer.selectedEntity)) {
      clearRestaurantPins(viewer);
      clearRoute(viewer);
      return;
    }

    // InfoBoxが表示された時の処理
    // InfoBoxはiframeで構成されているため、その中のdocumentに対してイベントリスナーを設定する必要がある
    const infoBoxIframe = viewer.infoBox.frame;

    // iframeのコンテンツが読み込まれたら、中の要素にアクセスしてイベントを設定
    infoBoxIframe.addEventListener(
      "load",
      () => {
        const iframeDoc = infoBoxIframe.contentDocument;
        if (!iframeDoc) return;

        // iframe内のドキュメントでクリックイベントを監視
        iframeDoc.body.addEventListener("click", (event) => {
          // クリックされた要素が経路ボタン（class="route-button"を持つ）か確認
          if (event.target && event.target.classList.contains("route-button")) {
            if (!lastClickedCoordinates) {
              alert("始点が選択されていません。地図上をクリックしてください。");
              return;
            }
            // ボタンのdata属性から目的地の緯度経度を取得
            const endCoords = {
              lon: parseFloat(event.target.dataset.lon),
              lat: parseFloat(event.target.dataset.lat),
            };
            // 経路描画関数を呼び出し
            drawRoute(viewer, lastClickedCoordinates, endCoords);
          }
        });
      },
      { once: true }
    ); // リスナーが複数登録されるのを防ぐため、一度だけ実行
  });

  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
  // 修正ここまで
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
}
