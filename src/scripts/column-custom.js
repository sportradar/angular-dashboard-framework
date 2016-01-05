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


/* global angular */
angular.module('adf')
  .directive('adfDashboardColumnCustom', function ($log, $compile, $rootScope, adfTemplatePath, rowTemplate, dashboard) {
    'use strict';

    function columnCustomController($scope) {

      $scope.columnState = {
        isHidden: false,
        isExpanded: false
      };

      var allowPutWidgetIntoColumn = function (widget, sourceColumn) {
        if ($scope.column === sourceColumn || !$scope.options.singleWidgetMode) {return true;}

        var allowPutWidget = !widget.minSize || $scope.column.width >= widget.minSize;
        var columnHasWidgets = $scope.column.widgets.length ? false : true;

        return columnHasWidgets && allowPutWidget;
      };

      $scope.addWidgetDialog = function () {
        $scope.$emit('addWidgetDialog', $scope.column);
      };

      $scope.$on('widgetToggleFullscreen', function (evt, expandedCid) {
        if ($scope.column.cid !== expandedCid) {
          $scope.columnState.isHidden = !$scope.columnState.isHidden;
        }
      });

      if (!angular.isDefined($scope.column.rows)) {
        $scope.sortableConfig = {
          group: {
            name: 'widgets',
            put: true
          },
          handle: '.adf-move',
          ghostClass: 'placeholder',
          animation: 150,
          onStart: function (evt) {
            $rootScope.$broadcast('widgetMoveStart', evt.model, $scope.column);
          },
          onEnd: function () {
            $rootScope.$broadcast('widgetMoveEnd');
          },
          onAdd: function () {
            $rootScope.$broadcast('adfWidgetAddedToColumn');
          },
          onRemove: function () {
            $rootScope.$broadcast('adfWidgetRemovedFromColumn');
          },
          onUpdate: function () {
            $rootScope.$broadcast('adfWidgetMovedInColumn');
          }
        };

        $scope.$on('widgetMoveStart', function (evt, widget, sourceColumn) {
          $scope.sortableConfig.group.put = allowPutWidgetIntoColumn(widget, sourceColumn);
        });

        $scope.$on('widgetMoveEnd', function () {
          $scope.sortableConfig.group.put = true;
          $rootScope.$broadcast('notifyDashboardWidgetChanged');
        });
      }
    }

    return {
      restrict: 'E',
      replace: true,
      scope: {
        column: '=',
        editMode: '=',
        continuousEditMode: '=',
        adfModel: '=',
        options: '='
      },
      templateUrl: adfTemplatePath + 'dashboard-column-custom.html',
      controller: columnCustomController,
      link: function ($scope, $element) {
        // set id
        var col = $scope.column;
        if (!col.cid) {
          col.cid = dashboard.id();
        }

        if (angular.isDefined(col.rows) && angular.isArray(col.rows)) {
          // be sure to tell Angular about the injected directive and push the new row directive to the column
          $compile(rowTemplate)($scope, function (cloned) {
            $element.append(cloned);
          });
        }
      }
    };

  });
