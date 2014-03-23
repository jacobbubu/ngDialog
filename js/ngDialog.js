/*
 * ngDialog - easy modals and popup windows
 * http://github.com/likeastore/ngDialog
 * (c) 2013 MIT License, https://likeastore.com
 */

(function (window, angular, undefined) {
	'use strict';

	var module = angular.module('ngDialog', []);

	var $el = angular.element;
	var isDef = angular.isDefined;
	var style = (document.body || document.documentElement).style;

	// see http://www.sitepoint.com/css3-animation-javascript-event-handlers/
	// for CSS Animation events
	var animationEndSupport = isDef(style.animation) || isDef(style.WebkitAnimation) || isDef(style.MozAnimation) || isDef(style.MsAnimation) || isDef(style.OAnimation);
	var animationEndEvent = 'animationend webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend';

	module.provider('ngDialog', function () {
		var defaults = this.defaults = {
			className: 'ngdialog-theme-default',
			plain: false,
			showClose: true,
			closeByDocument: true,
			closeByEscape: true
		};

		var globalID = 0, dialogsCount = 0, closeByDocumentHandler;

		this.$get = ['$document', '$templateCache', '$compile', '$q', '$http', '$rootScope', '$timeout',
			function ($document, $templateCache, $compile, $q, $http, $rootScope, $timeout) {
				var $body = $document.find('body');

				var privateMethods = {
					onDocumentKeyup: function (event) {
						//  ESC = '27'
						if (event.keyCode === 27) {
							publicMethods.close();
						}
					},

					closeDialog: function ($dialog) {
						// remove bound events
						if (typeof Hammer !== 'undefined') {
							Hammer($dialog[0]).off('tap', closeByDocumentHandler);
						} else {
							$dialog.unbind('click');
						}

						if (dialogsCount === 1) {
							$body.unbind('keyup').removeClass('ngdialog-open');
						}

						dialogsCount -= 1;

						if (animationEndSupport) {
							// destory scope whne closing animation finished
							$dialog.unbind(animationEndEvent).bind(animationEndEvent, function () {
								// retrieves the scope of the current element then destroy it
								// each $dialog has a new scope cretaed when $dialog opened
								// so do not forget to delete the scope object
								$dialog.scope().$destroy();

								// jqLite method, remove from dom
								$dialog.remove();
							}).addClass('ngdialog-closing');
						} else {
							$dialog.scope().$destroy();
							$dialog.remove();
						}

						$rootScope.$broadcast('ngDialog.closed', $dialog);
					}
				};

				var publicMethods = {

					/*
					 * @param {Object} options:
					 * - template {String} - id of ng-template, url for partial, plain string (if enabled)
					 * - plain {Boolean} - enable plain string templates, default false
					 * - scope {Object}
					 * - controller {String}
					 * - className {String} - dialog theme class
					 * - showClose {Boolean} - show close button, default true
					 * - closeByEscape {Boolean} - default true
					 * - closeByDocument {Boolean} - default true
					 *
					 * @return {Object} dialog
					 */
					open: function (opts) {
						var self = this;
						// deep clone then combine the properties
						var options = angular.copy(defaults);

						opts = opts || {};
						angular.extend(options, opts);

						globalID += 1;

						self.latestID = 'ngdialog' + globalID;

						// always create a new scope from a paased-in scope or $rootScoope
						// the new scope will prototypically inherit from the parent scope as the scope.$new implementation
						var scope = angular.isObject(options.scope) ? options.scope.$new() : $rootScope.$new();
						var $dialog;

						$q.when(loadTemplate(options.template)).then(function (template) {
							template = angular.isString(template) ?
								template :
								template.data && angular.isString(template.data) ?
									template.data :
									'';

							$templateCache.put(options.template, template);

							// add close button
							if (options.showClose) {
								template += '<div class="ngdialog-close"></div>';
							}

				// <div id="ngdialog1" class="ngdialog ngdialog-theme-default ng-scope" ng-controller="InsideCtrl">
				// 	<div class="ngdialog-overlay"></div>
				// 	<div class="ngdialog-content">
				// 		<div class="ngdialog-message">
				// 			...
				// 		</div>
				// 		<div class="ngdialog-buttons">
				// 			<button type="button" class="ngdialog-button ngdialog-button-secondary" ng-dialog="secondDialogId" ng-dialog-class="ngdialog-theme-default" ng-dialog-controller="SecondModalCtrl" ng-dialog-close-previous="">Close</button>
				// 			<button type="button" class="ngdialog-button ngdialog-button-primary" ng-click="openSecond()">Open next</button>
				// 		</div>
				// 	</div>
				// </div>
							self.$result = $dialog = $el('<div id="ngdialog' + globalID + '" class="ngdialog"></div>');
							$dialog.html('<div class="ngdialog-overlay"></div><div class="ngdialog-content">' + template + '</div>');

							if (options.controller && angular.isString(options.controller)) {
								$dialog.attr('ng-controller', options.controller);
							}

							if (options.className) {
								$dialog.addClass(options.className);
							}

							//  data could be JS object or is JSON string
							//  data be adhered to scope as ngDialogData property
							if (options.data && angular.isString(options.data)) {
								scope.ngDialogData = options.data.replace(/^\s*/, '')[0] === '{' ? angular.fromJson(options.data) : options.data;
							}

							// inject closeThisDialog into scope
							scope.closeThisDialog = function() {
								privateMethods.closeDialog($dialog);
							};

							// produce a template function then pass the scope into it
							// matching the dom elements to directive
							$timeout(function () {
								$compile($dialog)(scope);
							});

							// add $dialog into current dom
							$body.addClass('ngdialog-open').append($dialog);

							// and binding to global key event
							if (options.closeByEscape) {
								$body.bind('keyup', privateMethods.onDocumentKeyup);
							}

							if (options.closeByDocument) {
								closeByDocumentHandler = function (event) {
									var isOverlay = $el(event.target).hasClass('ngdialog-overlay');
									var isCloseBtn = $el(event.target).hasClass('ngdialog-close');

									if (isOverlay || isCloseBtn) {
										publicMethods.close($dialog.attr('id'));
									}
								};

								// $dialog will cover all of the body region
								if (typeof Hammer !== 'undefined') {
									Hammer($dialog[0]).on('tap', closeByDocumentHandler);
								} else {
									$dialog.bind('click', closeByDocumentHandler);
								}
							}

							dialogsCount += 1;

							$rootScope.$broadcast('ngDialog.opened', $dialog);

							return publicMethods;
						});

						function loadTemplate (tmpl) {
							if (!tmpl) {
								return 'Empty template';
							}

							if (angular.isString(tmpl) && options.plain) {
								return tmpl;
							}

							// return a cached template or a future (wil be auto cached in $cacheFactory)
							// https://github.com/angular/angular.js/commit/5dc35b527b3c99f6544b8cb52e93c6510d3ac577
							return $templateCache.get(tmpl) || $http.get(tmpl, { cache: true });
						}
					},

					/*
					 * @param {String} id
					 * @return {Object} dialog
					 */
					close: function (id) {
						var $dialog = $el(document.getElementById(id));

						if ($dialog.length) {
							privateMethods.closeDialog($dialog);
						} else {
							publicMethods.closeAll();
						}

						return publicMethods;
					},

					closeAll: function () {
						var $all = document.querySelectorAll('.ngdialog');

						angular.forEach($all, function (dialog) {
							privateMethods.closeDialog($el(dialog));
						});
					}
				};

				return publicMethods;
			}];
	});

	// directive implementation - convert attributes to options then call the service defined above
	// ngDialog is an attribute attached to a clickable element
	// sibling attributes mapping to ngDialog options
	// 	ngDialogClosePrevious, ngDialogCloseByDocument, ngDialogCloseByKeyup
	// 	ngDialogClass, ngDialogController, ngDialogScope, ngDialogShowClose
	module.directive('ngDialog', ['ngDialog', function (ngDialog) {
		return {
			restrict: 'A',
			link: function (scope, elem, attrs) {
				elem.on('click', function (e) {
					e.preventDefault();

					// why not just use isDef?
					angular.isDefined(attrs.ngDialogClosePrevious) && ngDialog.close(attrs.ngDialogClosePrevious);

					ngDialog.open({
						template: attrs.ngDialog,
						className: attrs.ngDialogClass,
						controller: attrs.ngDialogController,
						scope: attrs.ngDialogScope,
						data: attrs.ngDialogData,
						showClose: attrs.ngDialogShowClose === 'false' ? false : true,
						closeByDocument: attrs.ngDialogCloseByDocument === 'false' ? false : true,
						closeByEscape: attrs.ngDialogCloseByKeyup === 'false' ? false : true
					});
				});
			}
		};
	}]);

})(window, window.angular);
