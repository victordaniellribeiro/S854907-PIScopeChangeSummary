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

    _byProjectRows: undefined,
    _byTypeRows: undefined,
    _byFeatureRows: undefined,
    _byDefectRows: undefined,

    items: [{
            xtype: 'container',
            itemId: 'header',
            cls: 'header'
        },
        {
            xtype: 'container',
            itemId: 'bodyContainer',
            layout: 'anchor',
            width: '100%',
            height: '100%',
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


				    var promise = Deft.Chain.parallel([this._loadInitFeatures, 
				    									this._loadEndFeatures, 
				    									this._loadInitDefects, 
				    									this._loadEndDefects], this).then({
                        success: function(records) {
                            console.log('defects and features loaded:', records);
                            this._buildSummaryProject();
                    		this._buildSummaryType();
                            this._buildSummaryFeature();
                    		this._buildSummaryDefect();
                        },
                        failure: function(error) {
                            console.log('error:', error);
                        },
                        scope: this
                    });
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
                "_ValidTo",
                "Type"],
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
                    console.log('Init Features data loaded:', data);

                    this._initFeatures = data;

                    //this._loadEndFeatures();

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
                "_ValidTo",
                "Type"
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
                    // this._buildSummaryProject();
                    // this._buildSummaryType();

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
                "_ValidTo",
                "Type"
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
                    console.log('init defects data loaded:', data);

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
                "_ValidTo",
                "Type"
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
                    console.log('end defects data loaded:', data);

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
            // height: 85,
            forceFit: true,
            viewConfig: {
                //stripeRows: true,
                enableTextSelection: true
            },
            columns: [{
                    text: 'Summary by Projects',
                    flex: 3,
                    sortable: true,
                    dataIndex: 'projectName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'percChange'
                }]
        });

        var exportButton = Ext.create('Rally.ui.Button', {
        	text: 'Export by Project',
        	margin: '10 10 10 10',
        	scope: this,
        	handler: function() {
        		var csv = this._convertToCSV(this._byProjectRows);
        		console.log('converting to csv:', csv);


        		//Download the file as CSV
		        var downloadLink = document.createElement("a");
		        var blob = new Blob(["\ufeff", csv]);
		        var url = URL.createObjectURL(blob);
		        downloadLink.href = url;
		        downloadLink.download = "report.csv";  //Name the file here
		        document.body.appendChild(downloadLink);
		        downloadLink.click();
		        document.body.removeChild(downloadLink);
        	}
        });
        

        this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(exportButton);
        this.down('#bodyContainer').add(summaryProjectGrid);

        // this._myMask.hide();
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
                    sortable: true,
                    dataIndex: 'typeName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'percChange'
                }]
        });

        var exportButton = Ext.create('Rally.ui.Button', {
        	text: 'Export by Type',
        	margin: '10 10 10 10',
        	scope: this,
        	handler: function() {
        		var csv = this._convertToCSV(this._byTypeRows);
        		console.log('converting to csv:', csv);


        		//Download the file as CSV
		        var downloadLink = document.createElement("a");
		        var blob = new Blob(["\ufeff", csv]);
		        var url = URL.createObjectURL(blob);
		        downloadLink.href = url;
		        downloadLink.download = "report.csv";  //Name the file here
		        document.body.appendChild(downloadLink);
		        downloadLink.click();
		        document.body.removeChild(downloadLink);
        	}
        });
        

        // this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(exportButton);
        this.down('#bodyContainer').add(summaryTypeGrid);

        // this._myMask.hide();
    },



    _buildSummaryFeature: function() {
    	var store = this._createSummaryFeatureStore();


    	var summaryFeatureGrid = Ext.create('Ext.grid.Panel', {
            store: store,
            //height: 85,
            margin: '20 0 0 0',
            forceFit: true,
            viewConfig: {
                //stripeRows: true,
                enableTextSelection: true
            },
            columns: [{
                    text: 'Summary by Feature',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'featureNumber'
                }, {
                    text: 'Feature Name',
                    flex: 2,
                    sortable: true,
                    dataIndex: 'featureName'
                }, {
                    text: 'Project Name',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'projectName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'percChange'
                }]
        });

        var exportButton = Ext.create('Rally.ui.Button', {
        	text: 'Export by Feature',
        	margin: '10 10 10 10',
        	scope: this,
        	handler: function() {
        		var csv = this._convertToCSV(this._byFeatureRows);
        		console.log('converting to csv:', csv);


        		//Download the file as CSV
		        var downloadLink = document.createElement("a");
		        var blob = new Blob(["\ufeff", csv]);
		        var url = URL.createObjectURL(blob);
		        downloadLink.href = url;
		        downloadLink.download = "report.csv";  //Name the file here
		        document.body.appendChild(downloadLink);
		        downloadLink.click();
		        document.body.removeChild(downloadLink);
        	}
        });
        

        // this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(exportButton);
        this.down('#bodyContainer').add(summaryFeatureGrid);
    },


    _buildSummaryDefect: function() {
        var store = this._createSummaryDefectStore();


        var summaryDefectGrid = Ext.create('Ext.grid.Panel', {
            store: store,
            //height: 85,
            margin: '20 0 0 0',
            forceFit: true,
            viewConfig: {
                //stripeRows: true,
                enableTextSelection: true
            },
            columns: [{
                    text: 'Summary by Defect',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'defectNumber'
                }, {
                    text: 'Defect Name',
                    flex: 2,
                    sortable: true,
                    dataIndex: 'defectName'
                }, {
                    text: 'Project Name',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'projectName'
                }, {
                    text: 'Total Start Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalStartDay'
                }, {
                    text: 'Total End Day',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'totalEndDay'
                }, {
                    text: 'Adds',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'adds'
                }, {
                    text: 'Deletes',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'deletes'
                }, {
                    text: '% Change',
                    flex: 1,
                    sortable: true,
                    dataIndex: 'percChange'
                }]
        });

        var exportButton = Ext.create('Rally.ui.Button', {
            text: 'Export by Defect',
            margin: '10 10 10 10',
            scope: this,
            handler: function() {
                var csv = this._convertToCSV(this._byDefectRows);
                console.log('converting to csv:', csv);


                //Download the file as CSV
                var downloadLink = document.createElement("a");
                var blob = new Blob(["\ufeff", csv]);
                var url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = "report.csv";  //Name the file here
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        });
        

        // this.down('#bodyContainer').removeAll(true);
        this.down('#bodyContainer').add(exportButton);
        this.down('#bodyContainer').add(summaryDefectGrid);

        this._myMask.hide();
    },


    _createDefectRowSummaryByType: function() {
    	var defectRow;

    	var defectTotalStart = 0;
    	var defectTotalEnd = 0;
    	var defectTotalDelete = 0;
    	var defectTotalAdd = 0;

    	var initIds = [];
    	var endIds = [];

    	_.each(this._initDefects, function(defect) {
    		//console.log('feature:', feature);
    		initIds.push(defect.get('ObjectID'));
    	}, this);


    	_.each(this._endDefects, function(defect) {
    		//console.log('feature:', feature);
    		endIds.push(defect.get('ObjectID'));
    	}, this);



		_.each(this._initDefects, function(defect) {
    		//console.log('feature:', feature);
    		var defectId = defect.get('ObjectID');
            var defectInitPoints = defect.get('PlanEstimate');
			defectTotalStart += defectInitPoints;
            
            if (!Ext.Array.contains(endIds, defectId)) {
    			defectTotalDelete += defect.get('PlanEstimate');
            } else {
                var endDefect = this._getEndFeatureByObjectId(defectId, this._endDefects);
                var defectEndPoints = endDefect.get('PlanEstimate');
                if (defectInitPoints > defectEndPoints) {
                    defectTotalDelete += (defectInitPoints - defectEndPoints);
                } else {
                    defectTotalAdd += (defectEndPoints - defectInitPoints);
                }
            }
    	}, this);


    	_.each(this._endDefects, function(defect) {
    		//console.log('feature:', feature);
    		var defectId = defect.get('ObjectID');
            var defectEndPoints = defect.get('PlanEstimate');
			defectTotalEnd += defect.get('PlanEstimate');

            if (!Ext.Array.contains(initIds, defectId)) {
    			defectTotalAdd += defectEndPoints;
    		}
    	}, this);



    	var defectPercChange = 0;

		if (defectTotalEnd > defectTotalStart) {
			defectPercChange = (((defectTotalEnd / defectTotalStart) - 1) * 100).toFixed(2) + '%';
		} 

		if (defectTotalStart > defectTotalEnd) {
			defectPercChange = (((defectTotalEnd / defectTotalStart) - 1) * 100).toFixed(2) + '%';
		} 


    	defectRow = {
    		typeName: 'Defect',
			totalStartDay: defectTotalStart,
			totalEndDay: defectTotalEnd,
			adds: defectTotalAdd,
			deletes: defectTotalDelete,
			percChange: defectPercChange
    	};


    	return defectRow;
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


        _.each(this._initDefects, function(defect) {
            //console.log('feature:', feature);
            var projectName = defect.get('Project').Name;

            if (!mapProjectInit.containsKey(projectName)) {
                var artifacts = [];
                artifacts.push(defect);

                mapProjectInit.add(projectName, artifacts);
            } else {
                mapProjectInit.get(projectName).push(defect);
            }

        }, this);


        _.each(this._endDefects, function(defect) {
            //console.log('feature:', feature);
            var projectName = defect.get('Project').Name;

            if (!mapProjectEnd.containsKey(projectName)) {
                var artifacts = [];
                artifacts.push(defect);

                mapProjectEnd.add(projectName, artifacts);
            } else {
                mapProjectEnd.get(projectName).push(defect);
            }

        }, this);


    	mapProjectInit.eachKey(function(projectName, artifacts) {
    		// console.log('map init:', projectName, artifacts);

    		var totalStart = 0;
    		var totalEnd = 0;


            var totalAdd = 0;
            var totalDel = 0;

    		_.each(artifacts, function(feature) {
                var type = feature.get('FormattedID').startsWith('F') ? 'PortfolioItem/Feature' : 'Defect';
                var featureId = feature.get('ObjectID');

                var endFeature = this._getEndFeatureByObjectId(featureId, mapProjectEnd.get(projectName));
                var initFeaturePoints = 0;
                var endFeaturePoints = 0;
                
                if (type === "PortfolioItem/Feature") {
                    initFeaturePoints = feature.get('LeafStoryPlanEstimateTotal');
                    totalStart += initFeaturePoints;

                    if (endFeature) {
                        endFeaturePoints = endFeature.get('LeafStoryPlanEstimateTotal');
                    } 
                } else {
                    initFeaturePoints = feature.get('PlanEstimate');
                    totalStart += initFeaturePoints; 

                    if (endFeature) {
                        endFeaturePoints = endFeature.get('PlanEstimate');
                    }           
                }

                if (endFeature) {
                    // console.log('comparing:', feature.get('FormattedID'), initFeaturePoints, endFeaturePoints, totalStart, endFeature);
                    
                    if (endFeaturePoints > initFeaturePoints) {
                        totalAdd += (endFeaturePoints - initFeaturePoints);
                    } else {
                        totalDel += (initFeaturePoints - endFeaturePoints);
                    }

                    // console.log('total added', totalAdd);
                    // console.log('total removed', totalDel);                    
                }



    		}, this);


            totalAdd += this._getTotalPointsOfFeaturesAddedAfterInitDay(projectName, mapProjectEnd, mapProjectInit);
            totalDel += this._getTotalPointsOfFeaturesRemovedBeforeEndDay(projectName, mapProjectInit, mapProjectEnd);

    		totalEnd = this._calculateTotalEndDay(projectName, mapProjectEnd);
    		var adds = totalAdd;//this._calculateAdds(totalStart, totalEnd);
    		var deletes = totalDel;//this._calculateDeletes(totalStart, totalEnd);
    		var percChange = 0;

            percChange = (((totalEnd / totalStart) - 1) * 100).toFixed(2) + '%';

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


        // console.log('map end:', mapProjectEnd);
        //looking for projects not available at init, but present at end

        mapProjectEnd.eachKey(function(projectName, artifacts) {
            if (!mapProjectInit.containsKey(projectName)) {
                console.log('project added at end:', projectName, artifacts);

                var totalStart = 0;
                var totalEnd = this._calculateTotalEndDay(projectName, mapProjectEnd);

                var adds = this._calculateAdds(totalStart, totalEnd);
                var deletes = this._calculateDeletes(totalStart, totalEnd);
                var percChange = (adds * 100).toFixed(2) + '%';

                var row = {
                    projectName: projectName,
                    totalStartDay: totalStart,
                    totalEndDay: totalEnd,
                    adds: adds,
                    deletes: deletes,
                    percChange: percChange
                };

                rows.push(row);
            }

        }, this);



        //Calculate total
        var rowTotal = {
                projectName: 'Total',
                totalStartDay: 0,
                totalEndDay: 0,
                adds: 0,
                deletes: 0,
                percChange: 0
        };

        _.each(rows, function(row) {

            rowTotal['totalStartDay'] += row['totalStartDay'];
            rowTotal['totalEndDay'] += row['totalEndDay'];
            rowTotal['adds'] += row['adds'];
            rowTotal['deletes'] += row['deletes'];

            
          
        }, this);

        var percStr = (((rowTotal['totalEndDay'] / rowTotal['totalStartDay']) - 1) * 100).toFixed(2) + '%';
        rowTotal['percChange'] = percStr;

        rows.push(rowTotal);

    	console.log('rows', rows);
    	this._byProjectRows = rows;

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


    _getEndFeatureByObjectId: function(objectId, endArtifacts) {
        // console.log('Looking for artifact:', objectId);
        var artifact;

        _.each(endArtifacts, function(feature) {
            if (feature.get('ObjectID') === objectId) {
                // console.log('found:', feature);
                artifact = feature;
            }
        }, this);

        return artifact;

    },


    _getInitFeatureByObjectId: function(objectId, initArtifacts) {
        // console.log('Looking for artifact:', objectId);
        var artifact;

        _.each(initArtifacts, function(feature) {
            if (feature.get('ObjectID') === objectId) {
                // console.log('found:', feature);
                artifact = feature;
            }
        }, this);

        return artifact;

    },


    _getTotalPointsOfFeaturesAddedAfterInitDay: function(projectName, mapProjectEnd, mapProjectInit) {
        var total = 0;

        console.log('looking for project:', projectName);

        if (mapProjectEnd.containsKey(projectName)) {
            var artifacts = mapProjectEnd.get(projectName);
            // console.log('project found:', artifacts);

            _.each(artifacts, function(artifact) {
                var artifactId = artifact.get('ObjectID');

                var initArtifact = this._getInitFeatureByObjectId(artifactId, mapProjectInit.get(projectName));

                //artifact not present at init day
                if (!initArtifact) {
                    var type = artifact.get('FormattedID').startsWith('F') ? 'PortfolioItem/Feature' : 'Defect';
                    var artifactPoints = 0;
                    if (type === 'PortfolioItem/Feature') {
                        artifactPoints = artifact.get('LeafStoryPlanEstimateTotal');
                    } else {
                        artifactPoints = artifact.get('PlanEstimate');
                    }

                    // console.log('artifact not found at init f/d', artifactPoints);

                    total += artifactPoints;
                }
            }, this);
        }

        console.log('complete add points:', total);

        return total;
    },


    _getTotalPointsOfFeaturesRemovedBeforeEndDay: function(projectName, mapProjectInit, mapProjectEnd) {
        var total = 0;

        if (mapProjectInit.containsKey(projectName)) {
            var artifacts = mapProjectInit.get(projectName);
            _.each(artifacts, function(artifact) {
                var artifactId = artifact.get('ObjectID');

                var endArtifact = this._getEndFeatureByObjectId(artifactId, mapProjectEnd.get(projectName));

                //artifact not present at end day
                if (!endArtifact) {
                    var type = artifact.get('FormattedID').startsWith('F') ? 'PortfolioItem/Feature' : 'Defect';
                    var artifactPoints = 0;
                    if (type === 'PortfolioItem/Feature') {
                        artifactPoints = artifact.get('LeafStoryPlanEstimateTotal');
                    } else {
                        artifactPoints = artifact.get('PlanEstimate');
                    }

                    total += artifactPoints;
                }
            }, this);
        }


        console.log('complete del points:', total);


        return total;
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
            var featureId = feature.get('ObjectID');
            var featureInitPoints = feature.get('LeafStoryPlanEstimateTotal');
            featureTotalStart += featureInitPoints;

            if (!Ext.Array.contains(endIds, featureId)) {
                featureTotalDelete += feature.get('LeafStoryPlanEstimateTotal');
            } else {
                var endFeat = this._getEndFeatureByObjectId(featureId, this._endFeatures);
                var featureEndPoints = endFeat.get('LeafStoryPlanEstimateTotal');

                if (featureInitPoints > featureEndPoints) {
                    featureTotalDelete += (featureInitPoints - featureEndPoints);
                } else {
                    featureTotalAdd += (featureEndPoints - featureInitPoints);
                }
            }
    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
			featureTotalEnd += feature.get('LeafStoryPlanEstimateTotal');
            if (!Ext.Array.contains(initIds, featureId)) {
    			featureTotalAdd += feature.get('LeafStoryPlanEstimateTotal');
    		}
    	}, this);


    	var featurePercChange = 0;

		if (featureTotalEnd > featureTotalStart) {
			featurePercChange = (((featureTotalEnd / featureTotalStart) - 1) * 100).toFixed(2) + '%';
		} 

		if (featureTotalStart > featureTotalEnd) {
			featurePercChange = (((featureTotalEnd / featureTotalStart) - 1) * 100).toFixed(2) + '%';
		} 


    	rows.push({
    		typeName: 'Feature',
			totalStartDay: featureTotalStart,
			totalEndDay: featureTotalEnd,
			adds: featureTotalAdd,
			deletes: featureTotalDelete,
			percChange: featurePercChange

    	});



    	var defectRow = this._createDefectRowSummaryByType();

    	rows.push(defectRow);

    	this._byTypeRows = rows;
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


    _getFeatureRow: function() {
    	var row = {
    		featureName: '',
    		featureTotalStart: 0,
    		featureTotalEnd: 0,
    		adds: 0,
    		deletes: 0,
    		percChange: ''
    	};

    	return row;
    },


    _getDefectRow: function() {
        var row = {
            defectName: '',
            defectTotalStart: 0,
            defectTotalEnd: 0,
            adds: 0,
            deletes: 0,
            percChange: ''
        };

        return row;
    },



    _createSummaryFeatureStore: function() {
    	var rows = [];

    	var featureTotalStart = 0;
    	var featureTotalEnd = 0;
    	var featureTotalDelete = 0;
    	var featureTotalAdd = 0;

    	var initIds = [];
    	var endIds = [];

    	var allFeatures = new Ext.util.MixedCollection();
    	

    	_.each(this._initFeatures, function(feature) {
    		//console.log('feature:', feature);
			var featureId = feature.get('ObjectID');
    		initIds.push(featureId);

    		//console.log('init f, LeafPoint:', feature.get('LeafStoryPlanEstimateTotal'));

    		if (allFeatures.containsKey(featureId)) {
				allFeatures.get(featureId)['featureTotalStart'] = feature.get('LeafStoryPlanEstimateTotal');
			} else {
				var row = this._getFeatureRow();
                row['featureNumber'] = feature.get('FormattedID');
				row['featureName'] = feature.get('Name');
				row['featureTotalStart'] = feature.get('LeafStoryPlanEstimateTotal');
                row['projectName'] = feature.get('Project').Name;

				//console.log('row init:', row);
				allFeatures.add(featureId, row);
			}


    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
    		endIds.push(featureId);


    		if (allFeatures.containsKey(featureId)) {
				allFeatures.get(featureId)['featureTotalEnd'] = feature.get('LeafStoryPlanEstimateTotal');
			} else {				
				var row = this._getFeatureRow();
				row['featureNumber'] = feature.get('FormattedID');
                row['featureName'] = feature.get('Name');
				row['featureTotalEnd'] = feature.get('LeafStoryPlanEstimateTotal');
                row['projectName'] = feature.get('Project').Name;

				console.log('complete add, not available at init', row);
				allFeatures.add(featureId, row);
			}
    	}, this);




		_.each(this._initFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
    		if (!Ext.Array.contains(endIds, featureId)) {
    			allFeatures.get(featureId)['featureTotalDelete'] = feature.get('LeafStoryPlanEstimateTotal');
    		}
    	}, this);


    	_.each(this._endFeatures, function(feature) {
    		//console.log('feature:', feature);
    		var featureId = feature.get('ObjectID');
    		if (!Ext.Array.contains(initIds, featureId)) {
    			allFeatures.get(featureId)['featureTotalAdd'] = feature.get('LeafStoryPlanEstimateTotal');
    		} else {
    			//case of a feature being present at beggining and end
    			var totalAdd = feature.get('LeafStoryPlanEstimateTotal') - allFeatures.get(featureId)['featureTotalStart'];
    			if (totalAdd > 0) {
    				allFeatures.get(featureId)['featureTotalAdd'] = totalAdd;
    			} else {
					allFeatures.get(featureId)['featureTotalDelete'] = totalAdd * -1;
    			}
    		}
    	}, this);


    	allFeatures.eachKey(function(featureId, row) {
    		// console.log('map features:', featureId, row);

    		var totalStart = row['featureTotalStart'];
    		var totalEnd = row['featureTotalEnd'];

    		
    		var adds = row['featureTotalAdd'];

    		var percChange = 0;

    		if (totalStart === 0) {
				totalStart = 1;
    		 	percChange = (((totalEnd / totalStart)) *100).toFixed(2) + '%';
    		} else {
	    		if (totalEnd < totalStart) {
	    			percChange = '-' + ((1 - (totalEnd / totalStart))  *100).toFixed(2) + '%';
	    		} else if (totalStart  < totalEnd) {
	    			percChange = ((adds / totalStart)  *100).toFixed(2) + '%';
	    		}
    		}


    		var featureRow = {
                featureNumber: row['featureNumber'],
    			featureName: row['featureName'],
                projectName: row['projectName'],
    			totalStartDay: row['featureTotalStart'],
    			totalEndDay: row['featureTotalEnd'],
    			adds: row['featureTotalAdd'],
    			deletes: row['featureTotalDelete'],
    			percChange: percChange
    		};

    		rows.push(featureRow);

    	}, this);

    	console.log('rows', rows);
    	this._byFeatureRows = rows;

    	var store = Ext.create('Ext.data.JsonStore', {
			fields: ['featureNumber', 
                    'featureName', 
                    'projectName',
                    'totalStartDay',
                    'totalEndDay',
                    'adds',
                    'deletes',
                    'percChange']
        });

        store.loadData(rows);

		return store;
    },



    _createSummaryDefectStore: function() {
        var rows = [];

        var defectTotalStart = 0;
        var defectTotalEnd = 0;
        var defectTotalDelete = 0;
        var defectTotalAdd = 0;

        var initIds = [];
        var endIds = [];

        var allDefects = new Ext.util.MixedCollection();
        

        _.each(this._initDefects, function(defect) {
            //console.log('feature:', feature);
            var defectId = defect.get('ObjectID');
            initIds.push(defectId);

            //console.log('init f, LeafPoint:', feature.get('LeafStoryPlanEstimateTotal'));

            if (allDefects.containsKey(defectId)) {
                var mappedDefect = allDefects.get(defectId);
                mappedDefect['defectTotalStart'] = defect.get('PlanEstimate');

                var endDefect = this._getEndFeatureByObjectId(defectId, this._endFeatures);
                
                if (endDefect) {
                    var endDefectPoints = endDefect.get('PlanEstimate');
                    if (endDefectPoints > defect.get('PlanEstimate')) {
                        mappedDefect['defectTotalAdd'] = (endDefectPoints - defect.get('PlanEstimate'));
                    } else {
                        mappedDefect['defectTotalDelete'] = (defect.get('PlanEstimate') - endDefectPoints);
                    }
                } else {
                    //defect removed, thus, completed delete
                    mappedDefect['defectTotalDelete'] = defect.get('PlanEstimate');
                }
            } else {
                var row = this._getDefectRow();
                row['defectNumber'] = defect.get('FormattedID');
                row['defectName'] = defect.get('Name');
                row['defectTotalStart'] = defect.get('PlanEstimate');
                row['projectName'] = defect.get('Project').Name;


                var endDefect = this._getEndFeatureByObjectId(defectId, this._endDefects);
                
                if (endDefect) {
                    var endDefectPoints = endDefect.get('PlanEstimate');
                    if (endDefectPoints > defect.get('PlanEstimate')) {
                        row['defectTotalAdd'] = (endDefectPoints - defect.get('PlanEstimate'));
                    } else {
                        row['defectTotalDelete'] = (defect.get('PlanEstimate') - endDefectPoints);
                    }
                } else {
                    //defect removed, thus, completed delete
                    row['defectTotalDelete'] = defect.get('PlanEstimate');
                }

                //console.log('row init:', row);
                allDefects.add(defectId, row);
            }


        }, this);


        _.each(this._endDefects, function(defect) {
            //console.log('feature:', feature);
            var defectId = defect.get('ObjectID');
            endIds.push(defectId);


            if (allDefects.containsKey(defectId)) {
                var mappedDefect = allDefects.get(defectId);
                mappedDefect['defectTotalEnd'] = defect.get('PlanEstimate');

                var initDefect = this._getInitFeatureByObjectId(defectId, this._initDefects);
                
                if (initDefect) {
                    var initDefectPoints = initDefect.get('PlanEstimate');
                    if (initDefectPoints > defect.get('PlanEstimate')) {
                        mappedDefect['defectTotalDelete'] = (initDefectPoints - defect.get('PlanEstimate'));
                    } else {
                        mappedDefect['defectTotalAdd'] = (defect.get('PlanEstimate') - initDefectPoints);
                    }
                } else {
                    //defect removed, thus, completed delete
                    mappedDefect['defectTotalAdd'] = defect.get('PlanEstimate');
                }
            } else {    
                var row = this._getDefectRow();
                row['defectNumber'] = defect.get('FormattedID');
                row['defectName'] = defect.get('Name');
                row['defectTotalEnd'] = defect.get('PlanEstimate');
                row['projectName'] = defect.get('Project').Name;

                var initDefect = this._getInitFeatureByObjectId(defectId, this._initDefects);
                
                if (initDefect) {
                    var initDefectPoints = initDefect.get('PlanEstimate');
                    if (initDefectPoints > defect.get('PlanEstimate')) {
                        row['defectTotalDelete'] = (initDefectPoints - defect.get('PlanEstimate'));
                    } else {
                        row['defectTotalAdd'] = (defect.get('PlanEstimate') - initDefectPoints);
                    }
                } else {
                    //defect removed, thus, completed delete
                    row['defectTotalAdd'] = defect.get('PlanEstimate');
                }

                allDefects.add(defectId, row);
            }
        }, this);


        allDefects.eachKey(function(defectId, row) {
            // console.log('map features:', featureId, row);

            var totalStart = row['defectTotalStart'];
            var totalEnd = row['defectTotalEnd'];

            
            var adds = row['defectTotalAdd'];

            var percChange = 0;

            if (totalStart === 0) {
                totalStart = 1;
                percChange = (((totalEnd / totalStart)) *100).toFixed(2) + '%';
            } else {
                if (totalEnd < totalStart) {
                    percChange = '-' + ((1 - (totalEnd / totalStart))  *100).toFixed(2) + '%';
                } else if (totalStart  < totalEnd) {
                    percChange = ((adds / totalStart)  *100).toFixed(2) + '%';
                }
            }


            var defectRow = {
                defectNumber: row['defectNumber'],
                defectName: row['defectName'],
                projectName: row['projectName'],
                totalStartDay: row['defectTotalStart'],
                totalEndDay: row['defectTotalEnd'],
                adds: row['defectTotalAdd'],
                deletes: row['defectTotalDelete'],
                percChange: percChange
            };

            rows.push(defectRow);

        }, this);

        console.log('rows', rows);
        this._byDefectRows = rows;

        var store = Ext.create('Ext.data.JsonStore', {
            fields: ['defectNumber', 
                    'defectName', 
                    'projectName',
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
                var type = feature.get('FormattedID').startsWith('F') ? 'PortfolioItem/Feature' : 'Defect';
                if (type === "PortfolioItem/Feature") {
                    total += feature.get('LeafStoryPlanEstimateTotal');
                } else {
                    total += feature.get('PlanEstimate');
                }
    		}, this);

            console.log('calc total at end Day:', total);

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
    },


    _convertToCSV: function(objArray) {
		var fields = Object.keys(objArray[0]);

		var replacer = function(key, value) { return value === null ? '' : value; };
		var csv = objArray.map(function(row){
		  return fields.map(function(fieldName) {
		    return JSON.stringify(row[fieldName], replacer);
		  }).join(',');
		});

		csv.unshift(fields.join(',')); // add header column

		//console.log(csv.join('\r\n'));

		return csv.join('\r\n');
    }
});