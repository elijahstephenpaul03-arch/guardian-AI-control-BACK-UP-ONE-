// REST API proxy endpoint for OpenWeather API (Vercel Serverless Function)

function sendJsonResponse(res: any, statusCode: number, data: any) {
  if (typeof res.status === "function") {
    return res.status(statusCode).json(data);
  } else if (typeof res.json === "function") {
    res.statusCode = statusCode;
    return res.json(data);
  } else {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(data));
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  const { lat, lon } = req.query || {};

  if (!lat || !lon) {
    return sendJsonResponse(res, 400, { error: "lat and lon parameters are required." });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY || "01ef1daa7f76c7574fbd05059f468226";

  const mapWmoCode = (code: number): { main: string; description: string; icon: string } => {
    switch (code) {
      case 0:
        return { main: "Clear", description: "clear sky", icon: "01d" };
      case 1:
        return { main: "Clouds", description: "mainly clear", icon: "02d" };
      case 2:
        return { main: "Clouds", description: "partly cloudy", icon: "03d" };
      case 3:
        return { main: "Clouds", description: "overcast", icon: "04d" };
      case 45:
      case 48:
        return { main: "Fog", description: "foggy", icon: "50d" };
      case 51:
      case 53:
      case 55:
        return { main: "Drizzle", description: "drizzle", icon: "09d" };
      case 61:
      case 63:
      case 65:
        return { main: "Rain", description: "rain", icon: "10d" };
      case 71:
      case 73:
      case 75:
        return { main: "Snow", description: "snowfall", icon: "13d" };
      case 80:
      case 81:
      case 82:
        return { main: "Rain", description: "rain showers", icon: "09d" };
      case 95:
      case 96:
      case 99:
        return { main: "Thunderstorm", description: "thunderstorm", icon: "11d" };
      default:
        return { main: "Clouds", description: "partly cloudy", icon: "03d" };
    }
  };

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeather API responded with status ${response.status}`);
    }
    const data = await response.json();
    return sendJsonResponse(res, 200, data);
  } catch (error: any) {
    try {
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&wind_speed_unit=ms`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        throw new Error(`Open-Meteo responded with status ${fallbackRes.status}`);
      }

      const fallbackData = await fallbackRes.json();
      const current = fallbackData.current;
      if (!current) {
        throw new Error("Invalid Open-Meteo response");
      }

      const weatherCondition = mapWmoCode(current.weather_code);

      const normalizedData = {
        main: {
          temp: current.temperature_2m,
          humidity: current.relative_humidity_2m
        },
        weather: [
          {
            main: weatherCondition.main,
            description: weatherCondition.description,
            icon: weatherCondition.icon
          }
        ],
        wind: {
          speed: current.wind_speed_10m
        },
        name: "Active Kid Zone"
      };

      return sendJsonResponse(res, 200, normalizedData);
    } catch (fallbackError: any) {
      return sendJsonResponse(res, 500, { error: "Failed to fetch weather telemetry." });
    }
  }
}
