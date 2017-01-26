$("#autocomplete").on('focus', function () {
    geolocate();
});

var placeSearch, autocomplete;

function initialize() {
    // Create the autocomplete object, restricting the search
    // to geographical location types.
    autocomplete = new google.maps.places.Autocomplete(
        /** @type {HTMLInputElement} */ (document.getElementById('autocomplete')), {
            types: ['(cities)']
        });
    // When the user selects an address from the dropdown,
    // populate the address fields in the form.
    google.maps.event.addListener(autocomplete, 'place_changed', function () {
        fillInAddress();
    });

}

// [START region_fillform]
function fillInAddress(latitude, longitude) {
    // Get the place details from the autocomplete object.
    if (typeof latitude == 'undefined') {
        place = autocomplete.getPlace();
        var lat =  place.geometry.location.lat(),
            lon =   place.geometry.location.lng(),
            country = place.geometry;
    } else {
        var lat = latitude,
            lon = longitude;
    }

    var country = $("#autocomplete").val().split(", ").pop();

    if (country == 'United States') {
        units = 'Fahrenheit';
    } else {
        units = 'Celsius';
    }


    document.getElementById("message").innerHTML = "<span class = 'element'><br>";
    document.getElementById("message").style.color = "white";
    //$("#explanation").removeClass("FadedIn");
    $("#explanation").fadeOut();
    $(function () {
        $(".element").typed({
            strings: ["Finding city on map...^3000", "Glancing nervously at thermometer...^3000", "Sneaking past Trump to fetch weather archives...^6000", "Blast! He caught us. Please try again later (Yep, server error)."],
            typeSpeed: 5,
            showCursor: true,
            // character for cursor
            cursorChar: "|"
        });
    });


    Geodata = {lat: lat, lon: lon, units: units};
    $.ajax({
        url: '/location_weather',
        data: JSON.stringify(Geodata),
        type: 'POST',
        contentType: 'application/json;charset=UTF-8',
        success: function (text) {
            var result = $.parseJSON(text);
            var red = Math.round(result.p_rank / 100 * 255, 3),
            blue = 255 - red,
            green = Math.round(blue * 0.6, 3);

            document.getElementById("message").style.color = "rgb(" + red + "," + green + "," + blue + ")";
            document.getElementById("message").innerHTML = result.message;

            var date = new Date();


            if (result.t_max < 9000) {
                var full_expl = "Today's maximum of " + Math.round(result.t_max, 2) +
                    " " + units + " is hotter than " + Math.round(result.p_rank, 3) +
                    "% of the recordings we have for the " + ordinal_suffix_of(date.getDate()) + " of " +
                    date.toLocaleDateString("en-au", {month: "long"}) + ", going back to " + Math.min(...result.years) + ".";

                document.getElementById("explanation").innerHTML = full_expl;

                $("#explanation").fadeIn();


            }

            $('#facebookshare').data('href', 'https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Fwww.isittoohot.com%2F%3Fcity%3D' +
                encodeURIComponent($("#autocomplete").val()) +  '&amp;src=sdkpreparse');
            $('#facebookshare').show();


            respondCanvas(result);


        }

    });
}
// [END region_fillform]

// [START region_geolocation]
// Bias the autocomplete object to the user's geographical location,
// as supplied by the browser's 'navigator.geolocation' object.
function geolocate() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var geolocation = new google.maps.LatLng(
                position.coords.latitude, position.coords.longitude);

            var latitude = position.coords.latitude;
            var longitude = position.coords.longitude;

            autocomplete.setBounds(new google.maps.LatLngBounds(geolocation, geolocation));
        });
    }

}

function ordinal_suffix_of(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}


function respondCanvas(result) {
    var ctx = document.getElementById("summary").getContext("2d");

    var     red = Math.round(result.p_rank / 100 * 255, 3),
            blue = 255 - red,
            green = Math.round(blue * 0.6, 3);

    var gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, "rgba(" + red + "," + green + "," + blue + ",0.7)");
        gradient.addColorStop(1, 'rgba(151,187,205,0)');

    var chartData = {
                labels: result.years,
                datasets: [
                    {
                        label: 'temperature',
                        backgroundColor: gradient,
                        borderColor: "rgba(255,255,255,1)",
                        borderWidth: 0.4,
                        data: result.hist_temps
                    }
                ]
            };

    //Call a function to redraw other content (texts, images etc)
    var mychart = new Chart(ctx, {
        type: "line",
        data: chartData,
        options: {
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    ticks: {
                        fontColor: "#d4d4d4",
                        autoSkip: true,
                        maxTicksLimit: 12
                    },
                    scaleLabel: {
                        display: true,
                        fontColor: "#d4d4d4",
                        labelString: 'Year'
                      }
                }],
                yAxes: [{
                    ticks: {
                        fontColor: "#d4d4d4"
                    },
                    scaleLabel: {
                        display: true,
                        fontColor: "#d4d4d4",
                        labelString: 'Temperature (°' + units.charAt(0) + ')'
                      }
                }]
            }
        }

    });
}

initialize();
// [END region_geolocation]