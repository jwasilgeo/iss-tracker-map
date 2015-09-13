define([
	'./Globe',
	'./ISSTracker',

	'dijit/_TemplatedMixin',
	'dijit/_WidgetBase',

	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/date/locale',
	'dojo/sniff',
	'dojo/text!./MapWidget/templates/MapWidget.html',
	'dojo/topic',

	'esri/config',
	'esri/dijit/Geocoder',
	'esri/dijit/LocateButton',
	'esri/graphic',
	'esri/InfoTemplate',
	'esri/map',

	'require',

	'put-selector'
], function(
	Globe, ISSTracker,
	_TemplatedMixin, _WidgetBase,
	declare, lang, locale, has, template, topic,
	esriConfig, Geocoder, LocateButton, Graphic, InfoTemplate, Map,
	require,
	put
) {
	return declare([_WidgetBase, _TemplatedMixin], {
		templateString: template,
		postCreate: function() {
			this.inherited(arguments);
			this._determineCapabilities();
		},
		_determineCapabilities: function() {
			if (has('touch') && (has('iphone') || has('android') || has('bb')) && (has('device-width') < 500)) {
				require(['esri/dijit/PopupMobile'], lang.hitch(this, function(PopupMobile) {
					this.config.mapOptions.infoWindow = new PopupMobile(null, put('div'));
					this._initMap(true);
				}));
			} else {
				this._initMap(false);
			}
		},
		_initMap: function(isMobile) {
			esriConfig.defaults.map.panDuration = 200; // time in milliseconds, default panDuration: 350
			esriConfig.defaults.map.panRate = 1; // default panRate: 25
			esriConfig.defaults.map.zoomDuration = 200; // default zoomDuration: 500
			esriConfig.defaults.map.zoomRate = 1; // default zoomRate: 25

			this.map = new Map(this.mapNode, this.config.mapOptions);
			this.map.on('load', lang.hitch(this, '_initMapWidgets', isMobile));
		},
		_initMapWidgets: function(isMobile) {
			this._initLocateButton();
			this._initISSTracker();
			this._initGlobe();
			if (!isMobile) {
				this._initGeocoder();
			}
		},
		_initLocateButton: function() {
			this.locateUserInfoTemplate = new InfoTemplate();
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
			this._cleanupInfoWindow();
			this.map.infoWindow.setFeatures([evt.graphic]);
			topic.publish('locateButton/graphic', evt.graphic, 'locateButton');
		},
		_provideGeocoderLocation: function(evt) {
			this._cleanupInfoWindow();
			this.map.infoWindow.setFeatures([evt.result.feature]);
			if (!evt.result.feature.getInfoTemplate()) {
				evt.result.feature.setInfoTemplate(this.geocodeSelectInfoTemplate);
			}
			topic.publish('geocoder/feature', evt.result.feature, 'geocoder');
		},
		_cleanupInfoWindow: function() {
			if (this.map.infoWindow.isShowing) {
				this.map.infoWindow.hide();
				this.map.infoWindow.clearFeatures();
			}
		},
		_updateLocationPassTimes: function(passTimes, target) {
			var titleString = 'When can I spot it?';
			var contentDiv = put('div');
			var location = {
				latitude: passTimes.request.latitude.toFixed(4),
				longitude: passTimes.request.longitude.toFixed(4)
			};

			// build conditional content
			if (passTimes.message === 'success' && passTimes.response.length > 0) {
				var pass1 = passTimes.response[0];
				// datetime
				var pass1Date = new Date(pass1.risetime * 1000);
				var formattedDate = locale.format(pass1Date, {
					formatLength: 'long'
				});
				// duration
				var mins = Math.floor(pass1.duration / 60);
				var secs = pass1.duration % 60;
				var formattedDuration = mins + ' minutes and ' + secs + ' seconds';
				// content
				put(contentDiv, 'div', {
					innerHTML: 'The ISS will "rise" in the sky on ' + formattedDate + ', lasting for about ' + formattedDuration + '.'
				});
			} else {
				put(contentDiv, 'div', {
					innerHTML: 'Sorry, we were unable to find the next ISS flyover date for this location.'
				});
			}

			// build remaining content
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
				this.locateUserInfoTemplate.setTitle(titleString);
				this.locateUserInfoTemplate.setContent(contentDiv);
			} else if (target === 'geocoder') {
				this.geocodeSelectInfoTemplate.setTitle(titleString);
				this.geocodeSelectInfoTemplate.setContent(contentDiv);
			}
			this.map.infoWindow.setTitle(titleString);
			this.map.infoWindow.setContent(contentDiv);

			this.map.infoWindow.show(this.map.infoWindow.features[0].geometry);
		}
	});
});