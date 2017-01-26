from flask import Flask, render_template, json, request, redirect
import os, datetime

from temp_analysis import  WeatherQuery
import config



application = Flask(__name__)


@application.route("/")
def index(message = None):
    return render_template('bootstrap_landing.html')



@application.route('/location_weather', methods=['POST', 'GET'])
def get_historical_weather():

    lat = request.json['lat']
    lon = request.json['lon']
    units = request.json['units']

    try:
        IP = request.environ['REMOTE_ADDR']
    except:
        IP = "NoIP"

    print("DataRequest from %s for %s, %s at %s" %(IP,lat,lon,datetime.datetime.utcnow()))

    bq = WeatherQuery()
    weather_result = bq.compare_weather(lat, lon, units)

    return json.dumps(weather_result)

# run the app.
if __name__ == "__main__":

    application.debug = True
    application.run(threaded=True)
