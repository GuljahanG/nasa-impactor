from flask import Flask, request, jsonify, Response
import os
import requests
import json
import datetime
import math
import urllib.request
import urllib.parse
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)

NASA_KEY = os.environ.get("NASA_API_KEY")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY")
print(NASA_KEY)

SCHEMA_EXAMPLE = {
    "summary": "Short 1–3 sentence plan overview.",
    "rocketCount": 16,
    "profiles": [
        {
            "id": "wave-A",
            "count": 16,
            # scene units per second (client visualization)
            "speed": 3.0,
            "deltaV_kps": 1.2,      # required interceptor Δv (km/s)
            "hitRadius": 0.4,       # hit radius (scene units)
            "delaySec": 0           # 0 = launch all at once
        }
    ],
    "postShatter": {
        # radial Δv outward (km/s) to push debris away from Earth
        "targetRadial_dv_kps": 0.6,
        "minimumSafePerigee_km": 10000,  # minimum safe perigee for debris (km)
        "suggestExtraInterceptors": False
    }
}
SYSTEM_PROMPT = (
    "You are an expert in asteroid interception. "
    "Return ONLY valid JSON that strictly matches the requested schema. "
    "All numeric values must be realistic and in the requested units."
)


class AsteroidImpactPredictor:
    def __init__(self, api_key=OPENAI_KEY):
        self.api_key = api_key
        self.ai_api_url = "https://api.openai.com/v1/chat/completions"

    def predict_impact(self, lat, lon, mass_kg):
        """Send data to AI for impact prediction"""

        impact_data = {
            "lat": lat,
            "lon": lon,
            "mass_kg": mass_kg
        }

        prompt = self._create_ai_prompt(impact_data)
        return self._call_ai_api(prompt)

    def _create_ai_prompt(self, data):
        return f"""
        ASTEROID IMPACT PREDICTION:

        IMPACT PARAMETERS:
        - Latitude: {data['lat']}
        - Longitude: {data['lon']}
        - Asteroid Mass: {data['mass_kg']:,} kg

        Provide detailed analysis with numerical estimates for:

        1. POPULATION RISK:
           - Estimated casualties
           - Evacuation radius
           - Risk level

        2. ECONOMIC COSTS:
           - Damage estimate (USD)
           - Reconstruction cost
           - Time to rebuild

        3. IMPACT TIMELINE:
           - When impact would occur
           - Warning time
           - Evacuation timeline

        4. TSUNAMI ANALYSIS:
           - Wave height (if ocean impact)
           - Coastal flooding
           - Tsunami warning time

        5. ENVIRONMENTAL IMPACT:
           - Crater size
           - Atmospheric effects
           - Long-term consequences

        6. EMERGENCY RESPONSE:
           - Immediate actions
           - Evacuation plans
           - Resource requirements

        Be specific and provide numbers.
        """

    def _call_ai_api(self, prompt):

        client = OpenAI(
            api_key=OPENAI_KEY
        )
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Вы эксперт по ударам астероидов. Возвращайте только краткие, числовые оценки."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1200,
        )
        return response.choices[0].message.content or ""

        # # try:

        # json_data = json.dumps(data).encode('utf-8')
        # request_obj = urllib.request.Request(
        #     self.ai_api_url,
        #     data=json_data,
        #     headers=headers,
        #     method='POST'
        # )

        # with urllib.request.urlopen(request_obj) as response:
        #     result = json.loads(response.read().decode('utf-8'))
        #     return self._format_response(result)

        # except Exception as e:
        #     return self._generate_fallback_response()

    def _format_response(self, api_response):
        try:
            ai_text = api_response['choices'][0]['message']['content']

            return {
                "status": "success",
                "prediction": ai_text,
                "timestamp": datetime.datetime.now().isoformat(),
                "data_used": ["lat", "lon", "mass_kg"]
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to parse AI response: {str(e)}"
            }

    def _generate_fallback_response(self):
        """Fallback when AI API is not available"""
        return {
            "status": "demo_mode",
            "prediction": "This is a simulated AI response. With real API key, you would get actual AI predictions.",
            "example_analysis": {
                "population_risk": "High within 50km radius",
                "economic_cost": "~$50B reconstruction",
                "timeline": "Impact in 72 hours after detection",
                "tsunami_risk": "15m waves if ocean impact",
                "emergency_response": "Immediate evacuation within 100km"
            },
            "timestamp": datetime.datetime.now().isoformat()
        }

    def build_user_prompt(self, massKg: float, relSpeedKps: float, diameterM: float | None, densityKgM3: float | None):
        return f"""
            Given:
            - Asteroid mass (kg): {massKg:.6e}
            - Relative speed to Earth (km/s): {relSpeedKps:.3f}
            - Diameter (m): {diameterM if diameterM is not None else "n/a"}
            - Density (kg/m^3): {densityKgM3 if densityKgM3 is not None else "n/a"}

            Task:
            1) Estimate the required number of interceptors and their baseline guidance speed in SCENE UNITS per second (for client visualization).
            2) Provide the required interceptor Δv (km/s).
            3) Provide a hit radius (scene units) and a launch delay (seconds), where 0 = launch all at once.
            4) Provide post-shatter recommendations: radial Δv outward in km/s to push debris away from Earth, a minimum safe debris perigee (km), and whether an extra cleanup sweep is recommended.

            Return ONLY JSON that strictly matches the following format:
            {json.dumps(SCHEMA_EXAMPLE, ensure_ascii=False, indent=2)}
            """.strip()


# Initialize the predictor
predictor = AsteroidImpactPredictor()

# Simple statistics


@app.route("/api/home/stats")
def stats():
    url = "https://api.nasa.gov/neo/rest/v1/stats"
    r = requests.get(url, params={"api_key": NASA_KEY}, timeout=10)
    return (r.json(), r.status_code)


@app.route("/api/home/today_stats")
def today_stats():
    url = "https://api.nasa.gov/neo/rest/v1/feed/today"
    r = requests.get(
        url,
        params={"api_key": NASA_KEY, "detailed": "false"},
        timeout=10
    )
    return (r.json(), r.status_code)


@app.route("/api/neo/<neo_id>")
def neo(neo_id):
    url = f"https://api.nasa.gov/neo/rest/v1/neo/{neo_id}"
    r = requests.get(
        url,
        params={"api_key": NASA_KEY},
        timeout=10
    )
    return (r.json(), r.status_code)


@app.route("/api/neo/browse")
def neo_browse():
    url = "https://api.nasa.gov/neo/rest/v1/neo/browse"
    r = requests.get(
        url,
        params={"api_key": NASA_KEY},
        timeout=10
    )
    return (r.json(), r.status_code)

# AI Prediction


@app.route('/api/ai/predict-impact', methods=['POST'])
def predict_impact():
    """
    Predict asteroid impact consequences using AI
    Expects JSON: {"lat": number, "lon": number, "mass_kg": number}
    """
    try:
        # Get JSON data from request
        data = request.get_json()

        # Validate required parameters
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        required_fields = ['lat', 'lon', 'mass_kg']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        lat = float(data['lat'])
        lon = float(data['lon'])
        mass_kg = float(data['mass_kg'])

        # Validate ranges
        if not (-90 <= lat <= 90):
            return jsonify({"error": "Latitude must be between -90 and 90"}), 400

        if not (-180 <= lon <= 180):
            return jsonify({"error": "Longitude must be between -180 and 180"}), 400

        if mass_kg <= 0:
            return jsonify({"error": "Mass must be positive"}), 400

        # Get prediction from AI
        result = predictor.predict_impact(lat, lon, mass_kg)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": "Invalid number format"}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.post("/api/ai/plan-intercept")
def plan_intercept():
    data = request.get_json(force=True) or {}
    try:
        mass = float(data.get("massKg", 1e12))
        rel_kps = float(data.get("relSpeedKps", 8.0))
        diameter_m = float(
            data["diameterM"]) if "diameterM" in data and data["diameterM"] is not None else None
        density = float(
            data["densityKgM3"]) if "densityKgM3" in data and data["densityKgM3"] is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric inputs"}), 400

    user_prompt = predictor.build_user_prompt(
        mass, rel_kps, diameter_m, density)

    try:
        # Chat Completions API (stable & supported)
        client = OpenAI(
            api_key=NASA_KEY
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=800,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        text = resp.choices[0].message.content or ""

        # attempt to parse assistant output as JSON
        # (model instructed to output pure JSON)
        plan = json.loads(text)
        return jsonify(plan)

    except Exception as e:
        # fall back: safe message
        return jsonify({"error": f"AI call failed: {str(e)}"}), 500


@app.route('/api/ai/impact-examples', methods=['GET'])
def get_examples():
    """Get example impact scenarios"""
    examples = {
        "small_city_impact": {
            "lat": 40.7128,
            "lon": -74.0060,
            "mass_kg": 1000000,
            "description": "1M kg asteroid over New York"
        },
        "large_ocean_impact": {
            "lat": 34.0522,
            "lon": -118.2437,
            "mass_kg": 50000000,
            "description": "50M kg asteroid near Los Angeles (potential tsunami)"
        },
        "rural_impact": {
            "lat": 39.7392,
            "lon": -104.9903,
            "mass_kg": 500000,
            "description": "500K kg asteroid over Denver (low population)"
        }
    }
    return jsonify(examples)


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    services = {
        "nasa_api": "available" if NASA_KEY else "missing_key",
        "ai_api": "available" if OPENAI_KEY else "missing_key",
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat()
    }
    return jsonify(services)


if __name__ == "__main__":
    app.run(debug=True)
