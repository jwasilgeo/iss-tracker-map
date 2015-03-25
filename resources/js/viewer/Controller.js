define([
	'./widgets/MapWidget',
	'dojo/_base/declare'
], function(
	MapWidget, declare
) {
	return {
		startup: function(config, mapWidgetNode) {
			this.config = config;
			this._initWidgets(mapWidgetNode);
		},
		_initWidgets: function(mapWidgetNode) {
			this.mapWidget = new MapWidget({
				config: this.config,
			}, mapWidgetNode);
			this.mapWidget.startup();
		}
	};
});