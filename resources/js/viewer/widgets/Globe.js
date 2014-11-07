define([
	'dojo/_base/declare',
	'dojo/_base/array',
	'dojo/_base/lang',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
	'dijit/_WidgetsInTemplateMixin',

	'dojox/widget/Dialog',

	'd3/d3.min',
	'd3/topojson.v1.min',

	'dojo/text!./Globe/templates/Globe.html',
	'xstyle/css!./Globe/css/Globe.css',

	'./Globe/gis/world_110m', // topojson gis world boundaries as js

	'dojo/aspect',
	'dojo/dom-class',
	'dojo/dom-geometry',
	'dojo/dom-style',
	'dojo/request',
	'dojo/topic',

	'put-selector'
], function(
	declare, array, lang,
	_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
	Dialog,
	d3, topoJson,
	template, css,
	world_110m,
	aspect, domClass, domGeom, domStyle, dojoRequest, topic,
	put
) {
	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		templateString: template,
		baseClass: 'globe',
		postCreate: function() {
			this.inherited(arguments);
			this._initListener();
			this._initGeoJsonLine();
			this._initD3Globe();
			this._initThemeToggler();
		},
		_initListener: function() {
			topic.subscribe('iss/location', lang.hitch(this, '_updateGlobeGeometries'));
		},
		_initGeoJsonLine: function() {
			this._geoJsonLine = {
				type: 'LineString',
				coordinates: []
			};
			this._geoJsonPoint = {
				type: 'Point',
				coordinates: []
			};
		},
		_initD3Globe: function() {
			var dimensions = domGeom.getContentBox(document.body);
			// init w,h values; these will be readjusted when the dialog is opened
			var width = dimensions.w;
			var height = dimensions.h;
			// init scale value; make it smaller if doc body is small to begin with
			var minDimension = Math.min(width, height);
			// var initialScale = minDimension > 400 ? 150 : 110;
			var initialScale = minDimension / 3;

			var projection = d3.geo.orthographic()
				.scale(initialScale)
				.translate([width / 2, height / 2])
				.clipAngle(90);
			this._projection = projection;

			var geoPath = d3.geo.path()
				.projection(projection);
			this._geoPath = geoPath;

			var λ = d3.scale.linear()
				.domain([0, width])
				.range([-180, 180]);

			var φ = d3.scale.linear()
				.domain([0, height])
				.range([90, -90]);

			var zoom = d3.behavior.zoom()
				.translate([0, 0])
				.scale(1)
				.scaleExtent([1, 30])
				.size([width, height])
				.on('zoom', function() {
					var newScale = d3.event.scale;
					if (newScale === 1) {
						// set to initial projection scale
						projection.scale(initialScale);
					} else {
						// set to new scale with multiplier
						projection.scale(initialScale + (newScale * 15));
					}
					svg.selectAll('path').attr('d', geoPath);
				});

			var drag = d3.behavior.drag()
				.origin(function() {
					var rotate = projection.rotate();
					return {
						x: 2 * rotate[0],
						y: -2 * rotate[1]
					};
				})
				.on('drag', function() {
					projection.rotate([d3.event.x / 2, -d3.event.y / 2, projection.rotate()[2]]);
					svg.selectAll('path').attr('d', geoPath);
				});

			// set up the svg node at the passed in target node
			var svg = d3.select(this.svgTargetNode).append('svg')
				.attr('class', 'svgNode darkTheme')
				.attr('width', width)
				.attr('height', height)
				.call(zoom)
				.call(drag);
			this._svg = svg;

			// svg graticule layer
			svg.append('path')
				.datum(d3.geo.graticule().minorExtent([
					// all the way up the poles
					[-180, -90],
					[180, 90]
				]))
				.attr('class', 'graticule darkTheme')
				.attr('d', geoPath);

			// svg atmosphere sphere layer -- really just for outline and perhaps atmosphere effect
			svg.append('path')
				.datum({
					type: 'Sphere'
				})
				.attr('class', 'atmosphere darkTheme')
				.attr('d', geoPath);

			// svg ISS orbital path layer
			var issPathSelection = svg.append('path')
				.attr('class', 'orbital')
				.attr('d', geoPath);
			this._issPathSelection = issPathSelection;

			// svg ISS location point layer
			var issPointSelection = svg.append('path')
				.attr('class', 'spaceStation')
				.attr('d', geoPath);
			this._issPointSelection = issPointSelection;

			// load in countries topojson data
			// d3.json('./resources/js/viewer/widgets/Globe/gis/world-110m.json', function(error, world) {
			// insert this layer before/under the ISS orbital path layer
			svg.insert('path', '.atmosphere')
				.datum(topoJson.feature(world_110m, world_110m.objects.countries))
				.attr('class', 'land darkTheme')
				.attr('d', geoPath);
			// });
		},
		_updateGlobeGeometries: function(lngLat) {
			this._geoJsonLine.coordinates.push(lngLat);
			this._geoJsonPoint.coordinates = lngLat;

			var issPathSelection = this._issPathSelection;
			var issPointSelection = this._issPointSelection;
			var geoPath = this._geoPath;

			issPathSelection.datum(this._geoJsonLine);
			issPathSelection.attr('d', geoPath);

			issPointSelection.datum(this._geoJsonPoint);
			issPointSelection.attr('d', geoPath);
		},
		_initThemeToggler: function() {
			this.themeTogglerButton = put(this.svgTargetNode, 'i.icon-adjust.themeTogglerButton.darkTheme', {
				onclick: lang.hitch(this, 'toggleTheme'),
				title: 'Toggle color theme'
			});
		},
		toggleTheme: function() {
			if (domClass.contains(this.svgTargetNode, 'darkTheme') && domClass.contains(this.closeXButton, 'whiteIcon')) {
				this._svg.attr('class', 'svgNode lightTheme');
				d3.select('.land').attr('class', 'land lightTheme');
				d3.select('.graticule').attr('class', 'graticule lightTheme');
				d3.select('.atmosphere').attr('class', 'atmosphere lightTheme');
				put(this.themeTogglerButton, '.lightTheme!darkTheme');
				put(this.closeXButton, '.blackIcon!whiteIcon');
			} else {
				this._svg.attr('class', 'svgNode darkTheme');
				d3.select('.land').attr('class', 'land darkTheme');
				d3.select('.graticule').attr('class', 'graticule darkTheme');
				d3.select('.atmosphere').attr('class', 'atmosphere darkTheme');
				put(this.themeTogglerButton, '.darkTheme!lightTheme');
				put(this.closeXButton, '.whiteIcon!blackIcon');
			}
		},
		openContainer: function() {
			this.globeDialog.show();

			// resize the d3 globe and components after the dojox widget is sized and shown
			aspect.after(this.globeDialog, '_showContent', lang.hitch(this, function() {
				var dimensions = domGeom.getContentBox(this.globeDialog.domNode);
				this._svg.attr('width', dimensions.w);
				this._svg.attr('height', dimensions.h);
				this._projection.translate([dimensions.w / 2, dimensions.h / 2]);
				this._svg.selectAll('path').attr('d', this._geoPath);
				domStyle.set(this.globeDialog.containerNode, 'overflow', 'hidden');
			}));

		},
		closeContainer: function() {
			this.globeDialog.hide();
		}
	});
});