/**
 * настройки отладчика рисовалки paperjs
 */

"use strict";

/**
 * Алиасы глобальных свойств
 */
var acn,

/**
 * Константы и параметры
 */
	consts = new function Settings(){

	/**
	 * Прилипание. На этом расстоянии узел пытается прилепиться к другому узлу или элементу
	 * @property sticking
	 * @type {number}
	 */
	this.sticking = 90;
	this.sticking0 = this.sticking / 2;
	this.sticking2 = this.sticking * this.sticking;
	this.font_size = 60;

	this.lgray = new paper.Color(0.96, 0.98, 0.94, 0.96);


	// в пределах этого угла, считаем элемент вертикальным или горизонтальным
	this.orientation_delta = 7;

	this.tune_paper = function (settings) {
		/**
		 * Размер визуализации узла пути
		 * @property handleSize
		 * @type {number}
		 */
		settings.handleSize = 8;
	};



	this.move_points = 'move_points';
	this.move_handle = 'move_handle';



};