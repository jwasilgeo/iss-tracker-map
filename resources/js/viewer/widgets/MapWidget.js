define([
	'./Globe',
	'./ISSTracker',

	'dijit/_TemplatedMixin',
	'dijit/_WidgetBase',

	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/date/locale',
	'dojo/text!./MapWidget/templates/MapWidget.html',
	'dojo/topic',

	// 'esri/dijit/Geocoder',
	'esri/dijit/LocateButton',
	'esri/graphic',
	'esri/InfoTemplate',
	'esri/map',

	'put-selector'
], function(
	Globe, ISSTracker,
	_TemplatedMixin, _WidgetBase,
	declare, lang, locale, template, topic,
	/*Geocoder,*/
	LocateButton, Graphic, InfoTemplate, Map,
	put
) {
	return declare([_WidgetBase, _TemplatedMixin], {
		templateString: template,
		postCreate: function() {
			this.inherited(arguments);
			this._initMap();
		},
		_initMap: function() {
			this.map = new Map(this.mapNode, this.config.mapOptions);
			this.map.on('load', lang.hitch(this, '_initWidgets'));
		},
		_initWidgets: function() {
			this._initLocateButton();
			// this._initGeocoder();
			this._initISSTracker();
			this._initGlobe();
		},

		_initLocateButton: function() {
			this.locateUserInfoTemplate = new InfoTemplate();
			this.locateUserInfoTemplate.setTitle('When will it be overhead?');

			this.locateButton = new LocateButton({
				map: this.map,
				infoTemplate: this.locateUserInfoTemplate,
				'class': 'locateButton'
			}, this.locateNode);
			this.locateButton.startup();
			this.locateButton.on('locate', lang.hitch(this, '_provideUserLocation'));
			this.own(topic.subscribe('iss/passTimes', lang.hitch(this, '_updateLocationPassTimes')));
		},

		_initGeocoder: function() {
			this.geocodeSelectInfoTemplate = new InfoTemplate();
			this.geocoder = new Geocoder({
				map: this.map,
				autoComplete: true,
				highlightLocation: true,
				arcgisGeocoder: {
					placeholder: 'Enter an address or place'
				},
				'class': 'geocoder'
			}, this.geocoderNode);
			this.geocoder.on('select', lang.hitch(this, '_provideGeocoderLocation'));
			this.geocoder.startup();
		},

		_initISSTracker: function() {
			this.issTracker = new ISSTracker({
				map: this.map,
				config: this.config
			}, this.issTrackerNode);
			this.issTracker.startup();
		},
		_initGlobe: function() {
			this.globe = new Globe({}, this.globeNode);
			this.globe.startup();
		},

		_provideUserLocation: function(evt) {
			console.log(evt);
			this._cleanupInfoWindow();
			topic.publish('locateButton/graphic', evt.graphic, 'locateButton');
		},
		_provideGeocoderLocation: function(evt) {
			console.log(evt);
			this._cleanupInfoWindow();
			if (!evt.result.feature.getInfoTemplate()) {
				evt.result.feature.setInfoTemplate(this.geocodeSelectInfoTemplate);
				this.geocodeSelectInfoTemplate.setTitle('When will it be overhead?');
			}
			topic.publish('geocoder/feature', evt.result.feature, 'geocoder');
		},
		_cleanupInfoWindow: function() {
			if (this.map.infoWindow.isShowing) {
				this.map.infoWindow.hide();
				this.map.infowWindow.clearFeatures();
			}
		},
		_updateLocationPassTimes: function(passTimesResponse, target) {
			var contentDiv = put('div');
			var pass1 = passTimesResponse.response[0];
			var location = {
				latitude: passTimesResponse.request.latitude.toFixed(4),
				longitude: passTimesResponse.request.longitude.toFixed(4)
			};
			if (pass1.hasOwnProperty('risetime')) {

				var pass1Date = new Date(pass1.risetime * 1000);
				var formattedDate = locale.format(pass1Date, {
					formatLength: 'long'
				});

				var mins = Math.floor(pass1.duration / 60);
				var secs = pass1.duration % 60;
				var formattedDuration = mins + ' minutes and ' + secs + ' seconds';

				put(contentDiv, 'div', {
					innerHTML: 'The ISS will "rise" in the sky on: ' + formattedDate + ', lasting for about ' + formattedDuration + '.'
				});
			} else {
				put(contentDiv, 'div', {
					innerHTML: 'Sorry, we were unable to find the next ISS flyover date for this location.'
				});
			}

			put(contentDiv, 'div', {
				innerHTML: 'You can find out more at:'
			});
			var list = put(contentDiv, 'div');
			put(list, 'li', {
				innerHTML: '<a href="http://www.wolframalpha.com/input/?i=International+Space+Station+location+' + location.latitude + '+degrees+' + location.longitude + '+degrees" target="_blank">WolframAlpha</a>'
			});
			put(list, 'li', {
				innerHTML: '<a href="http://spotthestation.nasa.gov/sightings/index.cfm" target="_blank">NASA Spot The Station</a>'
			});

			if (target === 'locateButton') {
				this.locateUserInfoTemplate.setContent(contentDiv);
			} else if (target === 'geocoder') {
				this.geocodeSelectInfoTemplate.setContent(contentDiv);
			}
		}
	});
});