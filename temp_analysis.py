from google.cloud import bigquery
import json, datetime, os
from urllib import request as urllibrequest, parse
import config

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = config.Google_App_Credentials

class WeatherQuery():

    def explanation_sentence(self,percentile_rank):

        if (percentile_rank >= 0) and (percentile_rank < 40):
            return "No. It's OK.... Today at least."
        elif (percentile_rank >= 40) and (percentile_rank < 50):
            return "Not really"
        elif (percentile_rank >= 50) and (percentile_rank < 70):
            return "Yeah, a little bit"
        elif (percentile_rank >= 70) and (percentile_rank < 90):
            return "Yes, considerably"
        elif (percentile_rank >= 90) and (percentile_rank < 98):
            return "Quite seriously so"
        elif (percentile_rank >= 98) and (percentile_rank < 100):
            return "Concerningly too hot"
        elif percentile_rank == 100:
            return "We've broken a record, but not a good kind"

    def compare_weather(self,lat,lon, units = 'Celsius', nerdmode = False):

        today_max = self.open_weathermap_weather(lat,lon)

        if nerdmode == True:
            historical_maxes = self.query_noaa_ghcn_weather(lat,lon)
        else:
            historical_maxes = self.query_noaa_gsod_weather(lat,lon)

        surpass_count = 0
        for hist_max in historical_maxes:
            if today_max > hist_max[0]:
                surpass_count += 1

        if units == 'Fahrenheit':
            today_max = today_max * 1.8 + 32
            hist_temps = [round(item[0] * 1.8 + 32 ,2) for item in historical_maxes[::-1]]
            hist_temps.append(round(today_max,2))
        else:
            hist_temps = [round(item[0] ,2) for item in historical_maxes[::-1]]
            hist_temps.append(round(today_max,2))

        years = [int(item[1]) for item in historical_maxes[::-1]]
        years.append(2017)

        try:
            percentile_rank = surpass_count/len(historical_maxes) * 100
            message = self.explanation_sentence(percentile_rank)
            return {'p_rank': percentile_rank, 't_max': today_max, 'message': message, 'hist_temps': hist_temps, 'years': years}
        except ZeroDivisionError:
            message = "Sorry, not enough data for your city. Perhaps the records have combusted?"
            return {'p_rank': 9001, 't_max': 9001, 'message': message}


    def compare_yahoo_weather(self,lat,lon):

        today_max = self.open_weathermap_weather(lat,lon)
        historical_maxes = self.query_noaa_ghcd_weather(lat,lon)

        surpass_count = 0
        for hist_max in historical_maxes:
            if today_max > hist_max[0]:
                surpass_count += 1

        percent_rank = surpass_count/len(historical_maxes) * 100
        print(percent_rank)


    def yahoo_weather(self,city, country):
        baseurl = "https://query.yahooapis.com/v1/public/yql?"
        yql_query = "select * from weather.forecast where woeid in (SELECT woeid FROM geo.places WHERE text=\"%s, %s\")" %(city, country)
        yql_url = baseurl + parse.urlencode({'q':yql_query}) + "&format=json"
        result = urllibrequest.urlopen(yql_url).read().decode('utf-8')
        data = json.loads(result)
        results = data['query']['results']['channel']

    def open_weathermap_weather(self,lat,lon):
        now = datetime.datetime.utcnow()
        baseurl = "http://api.openweathermap.org/data/2.5/forecast?"
        fullurl = baseurl + parse.urlencode({'lat':lat, 'lon': lon, 'appid': config.OWM_APP_ID})
        result = urllibrequest.urlopen(fullurl).read().decode('utf-8')
        data = json.loads(result)
        forecast_list = data['list']

        candidate_temps = []
        for forecast in forecast_list:
            forecast_time = datetime.datetime.fromtimestamp(forecast['dt'])

            if (forecast_time - now).days < 1:
                candidate_temps.append(forecast['main']['temp_max']-273.15)


        return max(candidate_temps)

    def query_noaa_gsod_weather(self, lat, lon, range = 0.5):
        result_list = []

        query_results = self.bqclient.run_sync_query("""
            SELECT
              (max-32)*5/9 as celsius,
              year,
              name,
              lat,
              lon,
            FROM (
              SELECT
                max,
                year,
                mo,
                da,
                stn,
                name,
                lat,
                lon,
                POW((lat - %s),2) + POW((lon - %s),2) as distance,
                ROW_NUMBER() OVER(PARTITION BY year ORDER BY distance ASC) as rn
              FROM (
                SELECT
                  max,
                  year,
                  mo,
                  da,
                  stn,
                  wban
                FROM
                  TABLE_QUERY([bigquery-public-data:noaa_gsod], 'table_id CONTAINS "gsod"')) as a
              JOIN
                [bigquery-public-data:noaa_gsod.stations] as b
              ON
                a.stn=b.usaf
                AND a.wban=b.wban
              WHERE
                max<1000
                AND MONTH(CURRENT_DATE()) == INTEGER(mo)
                AND DAY(CURRENT_DATE()) == INTEGER(da)
                AND lat IS NOT NULL
                AND lon IS NOT NULL
                )
            WHERE
              rn=1
              AND distance < %s
            ORDER BY
              YEAR DESC
            """ % (lat, lon, range))

        query_results.use_legacy_sql = True
        query_results.run()
        page_token = None

        while True:
            rows, total_rows, page_token = query_results.fetch_data(
                max_results=10,
                page_token=page_token)

            for row in rows:
                result_list.append(row)

            if not page_token:
                break

        return result_list

    def query_noaa_ghcn_weather(self, lat, lon, range = 0.5):
        result_list = []

        query_results = self.bqclient.run_sync_query("""

            SELECT
              tmax as celsius,
              year,
              name,
              lat,
              lon
            FROM (
              SELECT
                tmax,
                date,
                YEAR(date) as year,
                name,
                latitude as lat,
                longitude as lon,
                POW((latitude - %s),2) + POW((longitude - %s),2) as distance,
                ROW_NUMBER() OVER(PARTITION BY year ORDER BY distance ASC) as rn
              FROM (
                SELECT
                  id,
                  IF (element = 'TMAX', value/10, NULL) AS tmax,
                  date
                FROM
                TABLE_QUERY([bigquery-public-data:ghcn_d],
                   'REGEXP_MATCH(table_id, r"^ghcnd_[\d]{4}")')) as a
              JOIN
                [bigquery-public-data:ghcn_d.ghcnd_stations] as b
              ON
                a.id=b.id
              WHERE
                tmax<1000
                AND DAYOFYEAR(CURRENT_DATE()) == DAYOFYEAR(date)
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                )
            WHERE
              rn=1
              AND distance < %s
            ORDER BY
              Year DESC
            """ % (lat, lon, range))

        query_results.use_legacy_sql = True
        query_results.run()
        page_token = None

        while True:
            rows, total_rows, page_token = query_results.fetch_data(
                max_results=10,
                page_token=page_token)

            for row in rows:
                result_list.append(row)
                print(row)

            if not page_token:
                break

        return result_list

    def __init__(self):

        self.bqclient = bigquery.Client()

if __name__ == '__main__':
    bq = WeatherQuery()
    # bq.yahoo_weather('Melbourne', 'Australia')
    # bq.query_noaa_gsod_weather(-37.8, 144.9)
    # bq.query_noaa_historical_weather('ASN00086038')
    # bq.query_noaa_closest_station(41.8, -87.6)