
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
function fillInAddress() {
    // Get the place details from the autocomplete object.
    var place = autocomplete.getPlace();

    var lat = place.geometry.location.lat();
    var lon = place.geometry.location.lng();
    document.getElementById("message").innerHTML = "<span class = 'element'><br>";
    document.getElementById("message").style.color = "white";
    //$("#explanation").removeClass("FadedIn");
    $("#explanation").fadeOut();
    $(function(){
      $(".element").typed({
        strings: ["Finding city on map...^3000", "Glancing nervously at thermometer...^3000", "Sneaking past Trump to fetch weather archives...^6000", "Blast! He caught us. Please try again later (Yep, server error)."],
        typeSpeed: 5,
        showCursor: true,
            // character for cursor
            cursorChar: "|"
      });
    });



    Geodata = {lat: lat, lon: lon};
    $.ajax({
        url: '/location_weather',
        data: JSON.stringify(Geodata),
        type: 'POST',
        contentType: 'application/json;charset=UTF-8',
        success : function(text) {
            result = $.parseJSON(text);

            red = Math.round(result.p_rank/100 * 255, 3)
            blue = 255 - red
            green = Math.round(blue * 0.6,3)
            document.getElementById("message").style.color = "rgb("+red+"," + green + ","+blue+")";
            document.getElementById("message").innerHTML = result.message;

            var date = new Date();


            if (result.t_max < 9000) {
                var full_expl = "Today's maximum of " + Math.round(result.t_max, 2) +
                    " celsius " + " is hotter than " + Math.round(result.p_rank, 3) +
                    "% of the recordings we have for the " + ordinal_suffix_of(date.getDate()) + " of " +
                    date.toLocaleDateString("en-au", {month: "long"}) + ", going back to 1929.";

                document.getElementById("explanation").innerHTML = full_expl;

                $("#explanation").fadeIn();


                //$("#explanation").addClass("FadedIn")


                //$(function () {
                //    $("#explanation").typed({
                //        strings: [full_expl],
                //        typeSpeed: 0,
                //        showCursor: false
                //    });
                //});
            }


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


initialize();
// [END region_geolocation]