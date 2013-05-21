/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 12/10/2012
 *
 */

var MapsLib = MapsLib || {};
var MapsLib = {

  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info

  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId: "1vP4neapn78SucXReab_cyuCcyPxANww6_o1lFu8",

  commAreasTableId: "1GtSykK6xHkeFrxmWK1VpvOaJltJgpa4o1bX7F14",
  ediTableId: "1bOniDCHwGJQRItiTiUc_Pz8Y0VGmIbP4bBhYIMM",

  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/
  //*Important* this key is for demonstration purposes. please register your own.
  googleApiKey: "AIzaSyDtJXRQCXB-WlDve_nLtHbeDjj3q4saCag",

  //name of the location column in your Fusion Table.
  //NOTE: if your location column name has spaces in it, surround it with single quotes
  //example: locationColumn:     "'my location'",
  locationColumn: "Longitude",

  map_centroid: new google.maps.LatLng(41.8781136, -87.66677856445312), //center that your map defaults to
  locationScope: "chicago", //geographical area appended to all address searches
  recordName: "Action", //for showing number of results
  recordNamePlural: "Actions",

  searchRadius: 805, //in meters ~ 1/2 mile
  defaultZoom: 11, //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage: 'http://derekeder.com/images/icons/blue-pushpin.png',
  currentPinpoint: null,

  initialize: function() {
    $("#result_count").html("");

    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [{
        "featureType": "landscape.natural.terrain",
        "stylers": [{
          "visibility": "off"
        }]
      }, {
        "featureType": "road.local",
        "stylers": [{
          "visibility": "off"
        }]
      }, {
        "featureType": "landscape.man_made",
        "stylers": [{
          "color": "#eff0ed"
        }]
      }, {
        "featureType": "road.arterial",
        "stylers": [{
          "color": "#ffffff"
        }, {
          "visibility": "simplified"
        }]
      }, {
        "featureType": "road.highway",
        "stylers": [{
          "color": "#ffffff"
        }, {
          "visibility": "simplified"
        }]
      }, {
        "featureType": "transit",
        "stylers": [{
          "visibility": "off"
        }]
      }, {
        "featureType": "poi",
        "stylers": [{
          "visibility": "off"
        }]
      }, {}, {
        "featureType": "road",
        "elementType": "labels.text",
        "stylers": [{
          "color": "#000000"
        }, {
          "weight": 0.1
        }]
      }, {
        "featureType": "road",
        "elementType": "labels",
        "stylers": [{
          "visibility": "off"
        }]
      }, {
        "featureType": "water",
        "stylers": [{
          "color": "#b0dad6"
        }]
      }, {
        "featureType": "administrative.locality",
        "elementType": "labels",
        "stylers": [{
          "visibility": "off"
        }]
      }]
    };
    map = new google.maps.Map($("#map_canvas")[0], myOptions);

    $("#search_address").val(MapsLib.convertToPlainString($.address.parameter('address')));
    var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    if (loadRadius != "") $("#search_radius").val(loadRadius);
    else $("#search_radius").val(MapsLib.searchRadius);
    $(".checked").attr("checked", "checked");
    $("#result_count").hide();
    $("#text_search").val("");

    /* MapsLib.commAreas = new google.maps.FusionTablesLayer({
      query: {
        from: MapsLib.commAreasTableId,
      }
    });
    MapsLib.commAreas.setMap(map);*/

    MapsLib.edi = new google.maps.FusionTablesLayer({
      query: {
        from: MapsLib.ediTableId,
      },
      styles: [{
        polygonOptions: {
          fillOpacity: 1
        }
      }, {
        where: "FourStage = 1",
        polygonOptions: {
          fillColor: "#EDF8FB"
        }
      }, {
        where: "FourStage = 2",
        polygonOptions: {
          fillColor: "#B2E2E2"
        }
      }, {
        where: "FourStage = 3",
        polygonOptions: {
          fillColor: "#66C2A4"
        }
      }, {
        where: "FourStage = 4",
        polygonOptions: {
          fillColor: "#238B45"
        }
      }]
    });
    MapsLib.edi.setMap(map);


    // maintains map centerpoint for responsive design
    google.maps.event.addDomListener(map, 'idle', function() {
      MapsLib.calculateCenter();
    });

    google.maps.event.addDomListener(window, 'resize', function() {
      map.setCenter(MapsLib.map_centroid);
    });

    MapsLib.searchrecords = null;

    //reset filters


    //-----custom initializers-------

    $("#age-slider").slider({
      orientation: "horizontal",
      range: true,
      min: 1997,
      max: 2013,
      values: [1997, 2013],
      step: 1,
      slide: function(event, ui) {
        $("#age-selected-start").html(ui.values[0]);
        $("#age-selected-end").html(ui.values[1]);
      },
      stop: function(event, ui) {
        MapsLib.doSearch();
      }
    });

    //-----end of custom initializers-------

    //run the default search
    MapsLib.doSearch();
  },

  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#search_address").val();
    MapsLib.searchRadius = $("#search_radius").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";

    //-----custom filters-------

    var text_search = $("#text_search").val().replace("'", "\'");
    if (text_search != '') whereClause += " AND 'Label' contains ignoring case '" + text_search + "'";


    var type_column = "'ActionFlag'";
    var searchType = type_column + " IN (-1,";
    if ($("#action1").is(':checked')) searchType += "1,";
    if ($("#action2").is(':checked')) searchType += "2,";
    if ($("#action3").is(':checked')) searchType += "3,";
    if ($("#action4").is(':checked')) searchType += "4,";
    if ($("#action5").is(':checked')) searchType += "5,";
    if ($("#action6").is(':checked')) searchType += "6,";
    if ($("#action7").is(':checked')) searchType += "7,";
    if ($("#action8").is(':checked')) searchType += "8,";
    whereClause += " AND " + searchType.slice(0, searchType.length - 1) + ")";

    var type_column = "'TypeFlag'";
    var searchType = type_column + " IN (-1,";
    if ($("#origop1").is(':checked')) searchType += "1,";
    if ($("#origop2").is(':checked')) searchType += "2,";
    if ($("#origop3").is(':checked')) searchType += "3,";
    whereClause += " AND " + searchType.slice(0, searchType.length - 1) + ")";

    var type_column = "'RecTypeFlag'";
    var searchType = type_column + " IN (-1,";
    if ($("#recop1").is(':checked')) searchType += "1,";
    if ($("#recop2").is(':checked')) searchType += "2,";
    if ($("#recop3").is(':checked')) searchType += "3,";
    if ($("#recop4").is(':checked')) searchType += "4,";
    if ($("#recop5").is(':checked')) searchType += "5,";
    if ($("#recop0").is(':checked')) searchType += "0,";
    whereClause += " AND " + searchType.slice(0, searchType.length - 1) + ")";


    whereClause += " AND 'Year' >= '" + $("#age-selected-start").html() + "'";
    whereClause += " AND 'Year' <= '" + $("#age-selected-end").html() + "'";


    if ($("#edi").is(':checked')) {
      MapsLib.edi.setMap(map);
    } else {
      MapsLib.edi.setMap(null)
    }


    //-------end of custom filters--------

    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1) address = address + " " + MapsLib.locationScope;

      geocoder.geocode({
        'address': address
      }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;

          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);

          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint,
            map: map,
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title: address
          });

          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";

          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
        } else {
          alert("We could not find your address: " + status);
        }
      });
    } else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },

  submitSearch: function(whereClause, map, location) {
    //get using all filters
    //NOTE: styleId and templateId are recently added attributes to load custom marker styles and info windows
    //you can find your Ids inside the link generated by the 'Publish' option in Fusion Tables
    //for more details, see https://developers.google.com/fusiontables/docs/v1/using#WorkingStyles

    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from: MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where: whereClause
      },
      styleId: 1,
      templateId: 2
    });
    MapsLib.searchrecords.setMap(map);
    MapsLib.getCount(whereClause);
  },

  clearSearch: function() {
    if (MapsLib.searchrecords != null) MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null) MapsLib.addrMarker.setMap(null);
    if (MapsLib.searchRadiusCircle != null) MapsLib.searchRadiusCircle.setMap(null);
  },

  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    } else {
      alert("Sorry, we could not find your location.");
    }
  },

  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({
      'latLng': latLngPoint
    }, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#search_address').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },

  drawSearchRadiusCircle: function(point) {
    var circleOptions = {
      strokeColor: "#4b58a6",
      strokeOpacity: 0.3,
      strokeWeight: 1,
      fillColor: "#4b58a6",
      fillOpacity: 0.05,
      map: map,
      center: point,
      clickable: false,
      zIndex: -1,
      radius: parseInt(MapsLib.searchRadius)
    };
    MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },

  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);

    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({
      url: "https://www.googleapis.com/fusiontables/v1/query?sql=" + sql + "&callback=" + callback + "&key=" + MapsLib.googleApiKey,
      dataType: "jsonp"
    });
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },

  getCount: function(whereClause) {
    var selectColumns = "Count()";
    MapsLib.query(selectColumns, whereClause, "MapsLib.displaySearchCount");
  },

  displaySearchCount: function(json) {
    MapsLib.handleError(json);
    var numRows = 0;
    if (json["rows"] != null) numRows = json["rows"][0];

    var name = MapsLib.recordNamePlural;
    if (numRows == 1) name = MapsLib.recordName;
    $("#result_count").fadeOut(function() {
      $("#result_count").html(MapsLib.addCommas(numRows) + " " + name + " found");
    });
    $("#result_count").fadeIn();
  },

  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },

  // maintains map centerpoint for responsive design
  calculateCenter: function() {
    center = map.getCenter();
  },

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  }

  //-----custom functions-------
  // NOTE: if you add custom functions, make sure to append each one with a comma, except for the last one.
  // This also applies to the convertToPlainString function above

  //-----end of custom functions-------
}