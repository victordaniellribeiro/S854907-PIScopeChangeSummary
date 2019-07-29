Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    _initDate: undefined,
    _endDate: undefined,
    _myMask: undefined,

    _baseReleaseName: undefined,
    _baseReleaseId: undefined,
    _releases: undefined,

    _initFeatures: undefined,
    _endFeatures: undefined,

    _initDefects: undefined,
    _endDefects: undefined,

    items: [{
            xtype: 'container',
            itemId: 'header',
            cls: 'header'
        },
        {
            xtype: 'container',
            itemId: 'bodyContainer',
            width: '100%',
            autoScroll: true
        }
    ],



    launch: function() {
        var context = this.getContext();
        var project = context.getProject()['ObjectID'];
        console.log('project:', project);

        this._projectId = project;

        this._myMask = new Ext.LoadMask({
            msg: 'Please wait...',
            target: this
        });


        var initDatePicker = Ext.create('Ext.form.field.Date', {
            fieldLabel: 'Start Date:',
            listeners: {
                select: function(picker, date) {
                    // console.log(date);
                    this._initDate = date.toISOString();
                },
                scope: this
            }
        });

        var endDatePicker = Ext.create('Ext.form.field.Date', {
            fieldLabel: 'End Date:',
            listeners: {
                select: function(picker, date) {
                    // console.log(date);
                    this._endDate = date.toISOString();
                },
                scope: this
            }
        });

        var releaseComboBox = Ext.create('Rally.ui.combobox.ReleaseComboBox', {
            itemId: 'releaseComboBox',
            fieldLabel: 'Release',
            showArrows: false,
            width: 450,
            //allowClear: true,
            listeners: {
                ready: function(combobox) {
                    this._baseReleaseId = combobox.getRecord().get('ObjectID');
                    this._baseReleaseName = combobox.getRecord().get('Name');
                },
                select: function(combobox, records, opts) {
                    this._baseReleaseId = combobox.getRecord().get('ObjectID');
                    this._baseReleaseName = combobox.getRecord().get('Name');
                },
            	scope: this
            }

        });

        var searchButton = Ext.create('Rally.ui.Button', {
            text: 'Search',
            margin: '10 10 10 100',
            scope: this,
            handler: function() {
                //handles search
                //console.log(initDate, endDate);
                this._doSearch();
            }
        });



        this.down('#header').add([{
            xtype: 'panel',
            title: 'PI Scope Change Filter:',
            //width: 450,
            layout: 'vbox',
            align: 'stretch',
            autoHeight: true,
            bodyPadding: 10,
            items: [{
                    xtype: 'fieldcontainer',
                    layout: 'hbox',
                    width: 800,
                    items: [
                        initDatePicker, {
                            xtype: 'label',
                            flex: 1,
                            margin: '0 0 0 20',
                            name: 'labelInit',
                            text: 'This represents the date of the commitment of the PI'
                        }
                    ]
                },
                {
                    xtype: 'fieldcontainer',
                    layout: 'hbox',
                    width: 800,
                    items: [
                        endDatePicker, {
                            xtype: 'label',
                            flex: 1,
                            margin: '0 0 0 20',
                            name: 'labelEnd',
                            text: 'This represent the date you want to compare to - usually current date'
                        }
                    ]
                },
                releaseComboBox,
                searchButton
            ]
        }]);
    },



    _doSearch: function() {
    	console.log('looking for data at:', this._initDate, this._endDate);
        if ((!this._initDate || this._initDate === '') && (!this._endDate || this._endDate === '')) {
            return;
        } else {
        	this._loadReleases();
        	// this._loadInitFeatures();
        }


        this._myMask.show();
    },



    _loadReleases: function() {
    	//this recovers all releases from a parent project given the release name.
    	Ext.create('Rally.data.wsapi.Store', {
		    model: 'Release',
		    autoLoad: true,
		    context: {
		        projectScopeUp: false,
		        projectScopeDown: true,
		        project: null //null to search all workspace
		    },


			filters: Rally.data.QueryFilter.or([
                Rally.data.QueryFilter.and([
                    {
                        property: 'Project.ObjectID',
                        value: this._projectId
                    },
                    {
                        property: 'name',
                        value: this._baseReleaseName
                    }   
                ]),
                    Rally.data.QueryFilter.or([

                        Rally.data.QueryFilter.and([
                            {
                                property: 'Project.parent.ObjectID',
                                value: this._projectId
                            },
                            {
                                property: 'name',
                                value: this._baseReleaseName
                            }   
                        ]),
                        
                        Rally.data.QueryFilter.and([
                            {
                                property: 'Project.parent.parent.ObjectID',
                                value: this._projectId
                            },
                            {
                                property: 'name',
                                value: this._baseReleaseName
                            }   
                        ])
                    ])
                ]),

		    listeners: {
		        load: function(store, data, success) {
		        	//console.log('Store:', store);
		            //console.log('Data:', data);

		            //this checks if the project is a leaf. 
		            //will return 0 child releases if so. else will return all releases id.
		            if (data.length > 0) {
		            	console.log('multiple releases found:', data);
			            var localReleases = [];

			            _.each(data, function(record) {
				        	localReleases.push(record.get('ObjectID'));
				        });

				        this._releases = localReleases;
				        console.log('releases: ', this._releases);
				    } else {
				    	console.log('single release found, using baseReleaseId:', baseReleaseId);
				    	this._releases = [baseReleaseId];
				    }


				    this._loadInitFeatures();
				},
		        scope: this
		    },
		    fetch: ['Description', 'Name', 'ObjectID'],
            limit: Infinity
        });
    },



    _loadInitFeatures: function() {
        var deferred = Ext.create('Deft.Deferred');
        console.log('loading init Features', this._initDate, this._endDate, this._projectId, this._baseReleaseId);

        var initFilter = [
        	{
                property: '__At',
                value: this._initDate
            },

            {
                property: '_TypeHierarchy',
                value: 'PortfolioItem/Feature'
            },
            {
                property: '_ProjectHierarchy',
                value: this._projectId
            },

            {
                property: 'Release',
                operator: 'in',
                value: this._releases
            }
        ];

        console.log('filters:', initFilter);


        var initStoriesStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch : ['Name', 
                'FormattedID', 
                'LeafStoryPlanEstimateTotal', 
                'LeafStoryCount', 
                'PreliminaryEstimate', 
                'State', 
                'Parent', 
                'PercentDoneByStoryPlanEstimate', 
                "_ValidFrom", 
                "_ValidTo"],
            hydrate: ['State', 'Project'],
            filters: initFilter,
            autoLoad: true,
            limit: Infinity,
            sorters: [{
                property: 'ObjectID',
                direction: 'ASC'
            }],

            listeners: {
                load: function(store, data, success) {
                    console.log('Features data loaded:', data);

                    this._initFeatures = data;
                    console.log(data);

                    this._loadEndFeatures();

                    deferred.resolve(data);
                },
                scope: this
            }
        });

        return deferred.promise;
    },


    _loadEndFeatures: function() {
    	var deferred = Ext.create('Deft.Deferred');
        console.log('loading end Features', this._initDate, this._projectId);

        var endFilter = [
        	{
		        property: '__At',
		        value: this._endDate
		    },

		    {
		        property: '_TypeHierarchy',
		        value: 'PortfolioItem/Feature'
		    },
		    {
		        property: '_ProjectHierarchy',
		        value: this._projectId
		    },

		    {
		        property: 'Release',
		        operator: 'in',
		        value: this._releases
		        //value: releaseId
		    }
		];


        var endStoriesStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['Name',
                'FormattedID', 
                'LeafStoryPlanEstimateTotal', 
                'LeafStoryCount', 
                'PreliminaryEstimate', 
                'State', 
                'Parent', 
                'PercentDoneByStoryPlanEstimate', 
                "_ValidFrom", 
                "_ValidTo"
            ],
            hydrate: ['State', 'Project'],
            filters: endFilter,
            autoLoad: true,
            limit: Infinity,
            sorters: [{
                property: 'ObjectID',
                direction: 'ASC'
            }],

            listeners: {
                load: function(store, data, success) {
                    console.log('end Features data loaded:', data);
                    
                    this._endFeatures = data;
                    console.log(data);

                    this._buildSummaryProject();
                    this._buildSummaryType();

                    deferred.resolve(data);
                },
                scope: this
            }
        });

        return deferred.promise;
    },


    _loadInitDefects: function() {
        var deferred = Ext.create('Deft.Deferred');
        console.log('loading init Defects', this._initDate, this._projectId);

        var initFilter = [
        	{
                property: '__At',
                value: this._initDate
            },

            {
                property: '_TypeHierarchy',
                value: 'Defect'
            },
            {
                property: '_ProjectHierarchy',
                value: this._projectId
            },

            {
                property: 'Release',
                operator: 'in',
                value: this._releases
            }
        ];


        var initStoriesStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['Name',
                'FormattedID',
                'ObjectID',
                'Project',
                'ScheduleState',
                'PlanEstimate',
                "_ValidFrom",
                "_ValidTo"
            ],
            hydrate: ['ScheduleState', 'Project'],
            filters: initFilter,
            autoLoad: true,
            limit: Infinity,
            sorters: [{
                property: 'ObjectID',
                direction: 'ASC'
            }],

            listeners: {
                load: function(store, data, success) {
                    console.log('defects data loaded:', data);

                    this._initDefects = data;

                    deferred.resolve(data);
                },
                scope: this
            }
        });

        return deferred.promise;
    },


    _loadEndDefects: function() {
        var deferred = Ext.create('Deft.Deferred');
        console.log('loading end Defects', this._endDate, this._projectId);

		var endFilter = [
        	{
		        property: '__At',
		        value: this._endDate
		    },

		    {
		        property: '_TypeHierarchy',
		        value: 'Defect'
		    },
		    {
		        property: '_ProjectHierarchy',
		        value: this._projectId
		    },

		    {
		        property: 'Release',
		        operator: 'in',
		        value: this._releases
		        //value: releaseId
		    }
		];


        var endDefectsStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['Name',
                'FormattedID',
                'ObjectID',
                'ScheduleState',
                'Project',
                'PlanEstimate',
                "_ValidFrom",
                "_ValidTo"
            ],
            hydrate: ['ScheduleState', 'Project'],
            filters: endFilter,
            autoLoad: true,
            limit: Infinity,
            sorters: [{
                property: 'ObjectID',
                direction: 'ASC'
            }],

            listeners: {
                load: function(store, data, success) {
                    console.log('defects data loaded:', data);

                    this._endDefects = data;

                    deferred.resolve(data);
                },
                scope: this
            }
        });

        return deferred.promise;
    },


    _buildSummaryProject: function() {
    	var store = this._createSummaryProjectStore();


    	var summaryProjectGrid = Ext.create('Ext.grid.Panel', {
            store: store,
            //height: 85,
            forceFit: true,
            viewConfig: {
                //stripeRows: true,
                enableTextSelection: true
            },
            columns: [{
                    text: 'Summary by Projects',
                    flex: 3,
                    sortable: false,
                    dataIndex: 'projectName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'percChange'
                }]
        });
        

        this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(summaryProjectGrid);

        this._myMask.hide();
    },


    _buildSummaryType: function() {
    	var store = this._createSummaryTypeStore();


    	var summaryTypeGrid = Ext.create('Ext.grid.Panel', {
            store: store,
            //height: 85,
            margin: '20 0 0 0',
            forceFit: true,
            viewConfig: {
                //stripeRows: true,
                enableTextSelection: true
            },
            columns: [{
                    text: 'Summary by Type',
                    flex: 3,
                    sortable: false,
                    dataIndex: 'typeName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: false,
                    dataIndex: 'percChange'
                }]
        });
        

        // this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(summaryTypeGrid);

        this._myMask.hide();
    },


    _createSummaryTypeStore: function() {
    	var rows = [];

    	var featureTotalStart = 0;
    	var featureTotalEnd = 0;
    	var featureTotalDelete = 0;
    	var featureTotalAdd = 0;

    	var initIds = [];
    	var endIds = [];

    	_.each(this._initFeatures, function(feature) {
    		//console.log('feature:', feature);
    		initIds.push(feature.get('ObjectID'));
    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		endIds.push(feature.get('ObjectID'));
    	}, this);



		_.each(this._initFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
    		if (Ext.Array.contains(endIds, featureId)) {
    			featureTotalStart += feature.get('LeafStoryPlanEstimateTotal');
    		} else {
    			featureTotalDelete += feature.get('LeafStoryPlanEstimateTotal');
    		}
    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
    		if (Ext.Array.contains(initIds, featureId)) {
    			featureTotalEnd += feature.get('LeafStoryPlanEstimateTotal');
    		} else {
    			featureTotalAdd += feature.get('LeafStoryPlanEstimateTotal');
    		}
    	}, this);



    	//TODO Check with stephanie how to calculate this.s
    	var featurePercChange = 0;

		if (featureTotalEnd > featureTotalStart) {
			featurePercChange = (100 - ((featureTotalEnd / featureTotalStart) *100)).toFixed(2) + '%';
		} 

		if (featureTotalStart >featureTotalEnd) {
			featurePercChange = "-" + (100 - ((featureTotalEnd / featureTotalStart) * 100)).toFixed(2) + '%';
		} 


    	rows.push({
    		typeName: 'Feature',
			totalStartDay: featureTotalStart,
			totalEndDay: featureTotalEnd,
			adds: featureTotalAdd,
			deletes: featureTotalDelete,
			percChange: featurePercChange

    	});

    	console.log('rows', rows);

    	var store = Ext.create('Ext.data.JsonStore', {
			fields: ['typeName', 
                    'totalStartDay',
                    'totalEndDay',
                    'adds',
                    'deletes',
                    'percChange']
        });

        store.loadData(rows);

		return store;

    },


    _createSummaryProjectStore: function() {

    	var rows = [];
    	var mapProjectInit = new Ext.util.MixedCollection();
    	var mapProjectEnd = new Ext.util.MixedCollection();

    	_.each(this._initFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var projectName = feature.get('Project').Name;

    		if (!mapProjectInit.containsKey(projectName)) {
    			var artifacts = [];
    			artifacts.push(feature);

    			mapProjectInit.add(projectName, artifacts);
    		} else {
    			mapProjectInit.get(projectName).push(feature);
    		}

    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var projectName = feature.get('Project').Name;

    		if (!mapProjectEnd.containsKey(projectName)) {
    			var artifacts = [];
    			artifacts.push(feature);

    			mapProjectEnd.add(projectName, artifacts);
    		} else {
    			mapProjectEnd.get(projectName).push(feature);
    		}

    	}, this);





    	mapProjectInit.eachKey(function(projectName, artifacts) {
    		console.log('map init:', projectName, artifacts);

    		var totalStart = 0;
    		var totalEnd = 0;

    		_.each(artifacts, function(feature) {
    			totalStart += feature.get('LeafStoryPlanEstimateTotal');
    		}, this);

    		var totalEnd = this._calculateTotalEndDay(projectName, mapProjectEnd);
    		var adds = this._calculateAdds(totalStart, totalEnd);
    		var deletes = this._calculateDeletes(totalStart, totalEnd);
    		var percChange = 0;

    		if (adds > 0 && deletes === 0) {
    			percChange = ((adds / totalStart) *100).toFixed(2) + '%';
    		} 

    		if (deletes > 0 && adds === 0) {
    			percChange = "-" + ((deletes / totalStart) * 100).toFixed(2) + '%';
    		} 

    		var row = {
    			projectName: projectName,
    			totalStartDay: totalStart,
    			totalEndDay: totalEnd,
    			adds: adds,
    			deletes: deletes,
    			percChange: percChange
    		};

    		rows.push(row);

    	}, this);

    	console.log('rows', rows);

    	var store = Ext.create('Ext.data.JsonStore', {
			fields: ['projectName', 
                    'totalStartDay',
                    'totalEndDay',
                    'adds',
                    'deletes',
                    'percChange']
        });

        store.loadData(rows);

		return store;
    },


    _calculateTotalEndDay: function(projectName, mapProjectEnd) {
    	if (!mapProjectEnd.containsKey(projectName)) {
    		return 0;
    	} else {
    		var total = 0;

    		_.each(mapProjectEnd.get(projectName), function(feature) {
				total += feature.get('LeafStoryPlanEstimateTotal');
    		}, this);

    		return total;
    	}
    },


    _calculateAdds: function(totalStart, totalEnd) {
    	var adds = 0;

    	if (totalEnd > totalStart){
    		adds = totalEnd - totalStart;
    	}

    	return adds;
    },


    _calculateDeletes: function(totalStart, totalEnd) {
    	var deletes = 0;

    	if (totalEnd < totalStart){
    		deletes = totalStart - totalEnd;
    	}

    	return deletes;
    }
});