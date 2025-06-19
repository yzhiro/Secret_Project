// src/weather.js （新規作成）

/**
 * OpenWeatherMap APIから指定した緯度経度の現在の天気を取得する
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @returns {Promise<Object|null>} - 簡略化された天気情報オブジェクト、またはエラー時にnull
 */
export async function getWeather(lat, lon) {
  const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.error("OpenWeatherMapのAPIキーが設定されていません。");
    return null;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API Error: ${response.statusText}`);
    }
    const data = await response.json();

    // 必要な情報だけを抽出して返す
    return {
      condition: data.weather[0].main, // "Rain", "Clouds", "Clear", "Snow" など
      description: data.weather[0].description, // "小雨", "曇りがち" など
      temperature: data.main.temp, // 気温
      iconUrl: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
    };
  } catch (error) {
    console.error("天気情報の取得に失敗しました:", error);
    return null;
  }
}