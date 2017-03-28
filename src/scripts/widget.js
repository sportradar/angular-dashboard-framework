/*
 * The MIT License
 *
 * Copyright (c) 2015, Sebastian Sdorra
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

angular.module('adf')
  .directive('adfWidget', function(_, $injector, $q, $log, $uibModal, $rootScope, dashboard, adfTemplatePath) {

    function preLink($scope) {
      var definition = $scope.definition;
      if (definition) {
        var w = dashboard.widgets[definition.type];
        if (w) {
          // pass title
          if (!definition.title) {
            definition.title = w.title;
          }

          //if (!definition.titleTemplateUrl) {
          //  definition.titleTemplateUrl = adfTemplatePath + 'widget-title.html';
          //  if (w.titleTemplateUrl) {
          //    definition.titleTemplateUrl = w.titleTemplateUrl;
          //  }
          //}

          //if (!definition.titleTemplateUrl) {
          //  definition.frameless = w.frameless;
          //}

          if (!definition.styleClass) {
            definition.styleClass = w.styleClass;
          }

          // set id for sortable
          if (!definition.wid) {
            definition.wid = dashboard.id();
          }

          // pass copy of widget to scope
          $scope.widget = angular.copy(w);

          $scope.widget.titleTemplateUrl = adfTemplatePath + 'widget-title-custom.html';
          if (w.titleTemplateUrl) {
            $scope.widget.titleTemplateUrl = w.titleTemplateUrl;
          }

          // merge default config object with definition from database
          for (var configIdx in w.config) {
            if(!definition.config) {
              definition.config = {};
            }
            if(!definition.config[configIdx]) {
              definition.config[configIdx] = angular.copy(w.config[configIdx]);
            }
          }

          //// create config object
          //var config = definition.config;
          //if (config) {
          //  if (angular.isString(config)) {
          //    config = angular.fromJson(config);
          //  }
          //} else {
          //  config = {};
          //}

          // pass config to scope
          $scope.config = definition.config;
          $scope.widgetSharedData = w.widgetSharedData ? angular.copy(w.widgetSharedData) : {};

          $scope.widgetSharedData.editMode = $scope.editMode;
          $scope.$watch('editMode', function(editMode){
            $scope.widgetSharedData.editMode = editMode;
          });

          // collapse exposed $scope.widgetState property
          if (!$scope.widgetState) {
            $scope.widgetState = {};
            $scope.widgetState.isCollapsed= (w.collapsed === true) ? w.collapsed : false;
            $scope.widgetState.configBeingEdited = false;
          }
        } else {
          $log.warn('could not find widget ' + definition.type);
        }
      } else {
        $log.debug('definition not specified, widget was probably removed');
      }
    }

    function postLink($scope, $element) {
      var definition = $scope.definition;
      if (definition) {
        // bind close function

        var deleteWidget = function() {
          var column = $scope.col;
          if (column) {
            //var index = column.widgets.indexOf(definition);
            var index = _.findIndex(column.widgets, function(w) { return w.wid === definition.wid; });
            if (index >= 0) {
              column.widgets.splice(index, 1);
            }
          }
          $element.remove();
          $rootScope.$broadcast('adfWidgetRemovedFromColumn');
          $scope.$emit('dashboardWidgetChanged');
        };

        $scope.remove = function() {
          if ($scope.options.enableConfirmDelete) {
            var deleteScope = $scope.$new();
            var deleteTemplateUrl = adfTemplatePath + 'widget-delete.html';
            if (definition.deleteTemplateUrl) {
              deleteTemplateUrl = definition.deleteTemplateUrl;
            }
            var opts = {
              scope: deleteScope,
              templateUrl: deleteTemplateUrl,
              backdrop: 'static'
            };
            var instance = $uibModal.open(opts);

            deleteScope.closeDialog = function() {
              instance.close();
              deleteScope.$destroy();
            };
            deleteScope.deleteDialog = function() {
              deleteWidget();
              deleteScope.closeDialog();
            };
          } else {
            deleteWidget();
          }
        };

        // bind reload function
        $scope.reload = function() {
          $scope.$broadcast('widgetReload');
        };

        // bind edit function
        $scope.edit = function() {
          var editScope = $scope.$new();
          editScope.definition = angular.copy(definition);

          var adfEditTemplatePath = adfTemplatePath + 'widget-edit.html';
          if (definition.editTemplateUrl) {
            adfEditTemplatePath = definition.editTemplateUrl;
          }

          var opts = {
            scope: editScope,
            templateUrl: adfEditTemplatePath,
            backdrop: 'static'
          };

          var instance = $uibModal.open(opts);

          editScope.closeDialog = function() {
            instance.close();
            editScope.$destroy();
          };

          // TODO create util method
          function createApplyPromise(result){
            var promise;
            if (typeof result === 'boolean'){
              var deferred = $q.defer();
              if (result){
                deferred.resolve();
              } else {
                deferred.reject();
              }
              promise = deferred.promise;
            } else {
              promise = $q.when(result);
            }
            return promise;
          }

          editScope.saveDialog = function() {
            // clear validation error
            editScope.validationError = null;

            // build injection locals
            var widget = $scope.widget;
            var applyFn = widget.edit.apply;
            var locals = {
              widget: widget,
              definition: editScope.definition,
              config: editScope.definition.config
            };

            // invoke apply function and apply if success
            var result = $injector.invoke(applyFn, applyFn, locals);
            createApplyPromise(result).then(function(){
              definition.title = editScope.definition.title;
              angular.extend(definition.config, editScope.definition.config);
              if (widget.edit && widget.edit.reload) {
                // reload content after edit dialog is closed
                $scope.$broadcast('widgetConfigChanged');
              }
              editScope.closeDialog();
            }, function(err){
              if (err){
                editScope.validationError = err;
              } else {
                editScope.validationError = 'Validation durring apply failed';
              }
            });
          };

        };
      } else {
        $log.debug('widget not found');
      }
    }

    return {
      replace: true,
      restrict: 'EA',
      transclude: false,
      templateUrl: adfTemplatePath + 'widget.html',
      scope: {
        definition: '=',
        col: '=column',
        editMode: '=',
        options: '=',
        widgetState: '=',
        columnState: '=',
        dashId: '='
      },
      controller: function($scope) {

        $scope.$on('adfDashboardCollapseExpand', function(event, args) {
          $scope.widgetState.isCollapsed = args.collapseExpandStatus;
        });

        $scope.$on('adfWidgetEnterEditMode', function(event, widget){
          if (dashboard.idEquals($scope.definition.wid, widget.wid)){
            $scope.edit();
          }
        });

        $scope.$on('widgetConfigUpdated', function(event, config) {
          var updatedConfig = config ? config : $scope.config;

          $scope.$emit('dashboardWidgetConfigUpdated', updatedConfig, $scope.definition.wid, $scope.col.cid);
        });

        $scope.$on('adfWidgetConfigChanged', function(event, id){
          var definition = $scope.definition;

          if(definition.wid === id){
            $scope.reload();
          }
        });

        $scope.$on('adfEditWidgetConfigStarted', function(event, id){
          var definition = $scope.definition;

          $scope.widgetState.configBeingEdited = definition.wid === id;
        });

        $scope.$watch('widgetState.showFilters', function(showFilters){
          // override definition.config when toggling filters content, to prevent loosing reference to the latest saved $scope.config object
          if(showFilters) {
            $scope.definition.config = $scope.config;
          }
        });


        $scope.widgetClasses = function(w, definition, widgetState){
          var classes = [];
          classes.push('widget-' + definition.type);

          if(definition.styleClass) {
            classes.push(definition.styleClass);
          }

          if (widgetState.configBeingEdited) {
            classes.push('widget-being-edited');
          }

          return classes;
        };

        $scope.openFullScreen = function() {
          var definition = $scope.definition;
          var fullScreenScope = $scope.$new();
          var opts = {
            scope: fullScreenScope,
            templateUrl: adfTemplatePath + 'widget-fullscreen.html',
            size: definition.modalSize || 'lg', // 'sm', 'lg'
            backdrop: 'static',
            windowClass: (definition.fullScreen) ? 'dashboard-modal widget-fullscreen' : 'dashboard-modal'
          };

          var instance = $uibModal.open(opts);
          fullScreenScope.closeDialog = function() {
            instance.close();
            fullScreenScope.$destroy();
          };
        };

        $scope.toggleWidgetFullscreen = function(){
          $scope.columnState.isExpanded = !$scope.columnState.isExpanded;
          $rootScope.$broadcast('widgetToggleFullscreen', $scope.col.cid);
        };
      },
      compile: function() {

        /**
         * use pre link, because link of widget-content
         * is executed before post link widget
         */
        return {
          pre: preLink,
          post: postLink
        };
      }
    };

  });
