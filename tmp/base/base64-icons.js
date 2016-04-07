/**
 * files
 * =====
 *
 * Собирает список исходных файлов для сборки на основе *deps* и *levels*, предоставляет `?.files` и `?.dirs`.
 * Используется многими технологиями, которые объединяют множество файлов из различных уровней переопределения в один.
 *
 * **Опции**
 *
 * * *String* **sourcesSuffix**
 * * *String* **types**
 * * *String* **target** — Результирующий files-таргет. По умолчанию — `?.files`.
 * * *String* **splitByGroups** — настройки для группировки файлов по конечнм целям.
 *
 * **Пример splitByGroup**
 *
 * ```javascript
 *   splitByGroups: {
 *     extra: '.extra-icon',    // файлы вида some-icon.extra-icon.png будут отсортированы в ?.icons.{type}.extra.css группу
 *     fallback: '.extra-icon', // файлы вида another-icon.fallback-icon.png будут отсортированы в ?.icons.{type}.fallback.css группу
 *     main : null              // остальные файлы попадут в ?.icons.{type}.main.css группу
 *   },
 *   target: '?.icons.{type}.{group}.css'
 * ```
 *
 * **Пример**
 *
 * ```javascript
 * nodeConfig.addTech(require('mumu/techs/base64-icons'));
 * ```
 */

var inherit = require('inherit'),
    Vow = require('vow'), // Используемая в ENB библиотека промисов
    path = require('path'),
    enb = require('enb/lib/api'),
    vowFs = enb.asyncFs;

module.exports = inherit(enb.BaseTech, {
    /**
     * @returns {String}
     */
    getName: function() {
        return 'base64-icons';
    },
    configure: function () {
        this._types = this.getRequiredOption('types');
        this._splitRules = this.getOption('splitByGroups', false);

        // Создаем список собираемых файлов.
        if (this._canSplitByGroups()) {

            // Проверка на правильную настройку splitByGroups.
            if (this.getRequiredOption('target').indexOf('{group}') === -1) {
                throw new Error('if splitByGroups option is defined, then you need to use {group} placeholder in target option');
            }

            // Сборка с группировкой.
            this._groupNames = Object.keys(this._splitRules);
            this._groupMarkers = [];
            this._targets = [];

            var typesLength = this._types.length;
            var groupsLength = this._groupNames.length;

            // Запомним все названия групп.
            for (var i = 0; i < typesLength; i++) {
                for (var x = 0; x < groupsLength; x++) {
                    this._targets.push(this._getTarget(this._types[i], this._groupNames[x]));
                }
            }

            // Запомним все маркеры.
            for (var groupName in this._splitRules) {
                if (this._splitRules.hasOwnProperty(groupName) && this._splitRules[groupName] !== null) {
                    this._groupMarkers.push(this._splitRules[groupName]);
                }
            }

        } else {
            // Сборка без группировки.
            this._targets = this._types.map(this._getTarget, this);
        }

        if (this._types.some(function(type) {
            return type.match(/^(combo|v|b)$/);
        })) {
            this._needReadFiles = true;
        }

        this._resetSelectorPrefix();
    },

    /**
     *
     * Можно ли использовать разделение по группам.
     *
     * @returns {boolean}
     * @private
     */
    _canSplitByGroups: function() {
        return Boolean(this._splitRules && Object.keys(this._splitRules).length);
    },

    /**
     * @param {String} type тип, для которого нужно получить имя цели
     * @param {String} [place...] тип, для которого нужно получить имя цели
     * @returns {String}
     */
    _getTarget: function(type, place) {
        var target = this.getRequiredOption('target');
        target = target.replace('{type}', type);
        if (place) {
            target = target.replace('{group}', place);
        }

        return this.node.unmaskTargetName(target);
    },

    /**
     * Проверка на принадлежность к группе по умолчанию(не имеющая маркера).
     *
     * @param name
     *   Имя файла
     * @returns {boolean}
     * @private
     */
    _isDefaultGroup: function(name) {
        // Если ни один маркер не попадается в имени файла,
        // значит это группа по умолчанию(та, которая не имеет маркера).
        return !Boolean(this._groupMarkers.some(function(marker) {
            return Boolean(name.match(new RegExp('\b' + marker + '\b')));
        }));
    },

    /**
     * Получение списка групп.
     *
     * Если группы не используются, то передается список с одним нулевым элементом.
     * Костыль для правильно работы, когда группы выключены.
     *
     * @returns {array}
     *   список групп.
     * @private
     */
    _getGroups: function() {
        if (!this._splitRules) {
            return [null];
        }
        return this._groupNames;
    },

    /**
     * Получить маркер по имени группы.
     *
     * @param groupName
     * @returns {*}
     * @private
     */
    _getMarkerByGroup: function(groupName) {
        return this._splitRules[groupName];
    },

    /**
     * Попадает ли имя файла под текущую группу.
     *
     * @param name
     *   Имя файла
     * @param groupName
     *   Имя группы
     * @returns {boolean}
     * @private
     */
    _isMarkered: function(name, groupName) {
        var marker = this._getMarkerByGroup(groupName);

        if (marker && name.match(new RegExp('\\b' + marker + '\\b'))) {
            return true;
        } else if (!marker && this._isDefaultGroup(groupName)) {
            return true;
        }

        return false;
    },

    /**
     * @returns {Array} Все цели
     */
    getTargets: function() {
        return this._targets;
    },

    /**
     * @description Строит список исходников, сортирует их и производит сборку.
     * @returns {Promise}
     */
    build: function () {
        var self = this;

        return this.getSourcesList().then(function(list) {
            var files = {v: [], b: []};
            list.forEach(function(file) {
                files.v.push(file.v || file.b);
                if (file.b) {
                    files.b.push(file.b);
                }
            });
            return self.doBuild(files);
        });
    },

    /**
     * @description Собирает список исходников, избавляется от дубликатов и сортирует его.
     * @returns {Promise}
     */
    getSourcesList: function() {
        var self = this,
            suffix = this.getRequiredOption('sourcesSuffix'),
            suffixes = ['svg', 'jpg', 'jpeg', 'png', 'gif'].map(function(ext) {
                return suffix + '.' + ext;
            });
        return Vow.all({
            files: this.node.requireSources(['?.files']).spread(function(result) {
                var files = result.getBySuffix(suffixes);
                return files;
            }),
            dirs: this.node.requireSources(['?.dirs']).spread(function(result) {
                var files = [];
                result.getBySuffix(suffix).forEach(function(dir) {
                    files = files.concat(dir.files);
                });
                return files;
            })
        }).then(function(data) {
            var files = data.files.concat(data.dirs);
            return self._getUniqueNames(files).sort(function(a, b) {
                if (a.name === b.name) {
                    return 0;
                }
                return a.name < b.name ? -1 : 1;
            });
        });

    },
    /**
     * @description Избавляется от дубликатов в списке файлов и распределяет их по спискам v и b.
     * @param {Array} list список файлов
     * @returns {Array}
     */
    _getUniqueNames: function(list) {
        var keys = {};
        list.forEach(function(file) {
            var filename = file.filename = this.node.relativePath(file.fullname),
                ext = file.ext = path.extname(filename),
                base = path.basename(filename, ext),
                obj = keys[base];

            if (!obj) {
                obj = keys[base] = {
                    name: base
                };
            }
            obj[ext === '.svg' ? 'v' : 'b'] = file;
        }, this);

        var uniq = [];

        for (var key in keys) {
            var pair = keys[key];
            if (!pair.b) {
                console.warn('WARNING! There is no degradation image file for "' + key + '",\n\ttargets: ', this._targets.join(', '));
            }
            if (!pair.v) {
                console.warn('WARNING! There is no vector image file for "' + key + '",\n\ttargets: ', this._targets.join(', '));
            }
            uniq.push(pair);
        }
        return uniq;
    },
    /**
     * @description Из списков файлов собирает необходимые цели.
     * @param {Object} data Объект с двумя списками, v - svg файлы, b - все остальные.
     * @returns {Promise}
     */
    doBuild: function (data) {
        // Генерируем css файлы по очереди, каждый тип за раз (png, svg, combo).
        // TODO: возможно Vow тут вовсе не нужен.
        return Vow.all(this._types.map(function (type) {
            return Vow.all(this._getGroups().map(function (groupName) {

                /**
                 * Cписок сгенерированных css правил
                 * @type {array} res
                 */
                var res;
                /**
                 * Массив файлов объектов.
                 * @type {[object]} [list] */
                var list = data[type === 'v' ? 'v' : 'b'];
                /**
                 * Имя файла для записи.
                 * @type {String}
                 */
                var target = this._getTarget(type, groupName);

                var svgEncodeAction = this.getOption('svgToBase64') ? this._toBase64 : this._toEncode;

                if (type === 'combo') {
                    /* комборежим использует оба списка */
                    list = list.concat(data.v);
                }

                if (!this._needRebuild(target, list)) {
                    this.node.isValidTarget(target);
                    this.node.resolveTarget(target);
                    return;
                }

                return this._readFiles(list).then(function (list) {

                    // Если включен режим группирования, то фильтруем список файлов по группе.
                    if (this._canSplitByGroups()) {
                        list = list.filter(function (file) {
                            return this._isMarkered(file.name, groupName);
                        }, this);
                    }

                    // Кодирование ресурса в нужный вид.
                    switch (type) {
                        case 'v':
                            res = list.map(svgEncodeAction, this);
                            break;
                        case 'b':
                            res = list.map(this._toBase64, this);
                            break;
                        case 'ie':
                            res = list.map(this._toLink, this);
                            break;
                        case 'ie6':
                            res = list.map(this._toFilter, this);
                            break;
                        case 'combo':
                            this._applyFallbackSelectorPrefix();
                            var fallback = data.b.map(this._toLink, this);
                            this._resetSelectorPrefix();

                            res = data.v.map(svgEncodeAction, this).concat(fallback);
                            break;
                        default:
                            throw new Error('Unknown target type "' + type + '"');
                    }

                    // Склеиваем CSS правила и пишеи в файл.
                    var target = this._getTarget(type, groupName);
                    return this._write(target, res.join('\n'), list);
                }, function () {
                    throw new Error('Unexpected error on _readFiles');
                }, this);


            }, this));
        }, this));
    },



    /**
     * @decription Определяет, нужно ли собирать эту цель
     * @param {String} target
     * @param {Array} list список файлов источников
     * @returns {Boolean}
     */
    _needRebuild: function(target, list) {
        var cache = this.node.getNodeCache(target);
        if (cache.needRebuildFile('target', this.node.resolvePath(target))) {
            return true;
        }
        if (cache.needRebuildFileList('list', list)) {
            return true;
        }
        return false;
    },
    /**
     * @description При необходимости для каждого файлов в списке data читает его содержимое.
     * @param {Array} data список файлов
     * @returns {Promise}
     */
    _readFiles: function(data) {
        if (this._needReadFiles) {
            return Vow.all(data.map(function(file) {
                if (!file.readPromise) {
                    file.readPromise = vowFs.read(file.fullname).then(function(result) {
                        file.data = result;
                        return file;
                    }, function(err) {
                        throw new Error('Can\'t read file "' + file.fullname + '": ' + err);
                    });
                }
                return file.readPromise;
            })).then(function () {
                return data;
            });
        } else {
            return Vow.fulfill(data);
        }
    },
    /**
     * @description Записывает сгенерированные файлы на диск.
     * @param {String} type тип цели
     * @param {String} data содержание файла
     * @param {Array} list список файлов источников
     * @returns {Promise}
     */
    _write: function(target, data, list) {

        return vowFs.write(this.node.resolvePath(target), data, 'utf-8').then(function() {
            this.node.resolveTarget(target, data);
            this._saveCache(target, this.node.resolvePath(target), list);
        }, function(err) {
            this.node.rejectTarget(target, err);
        }, this);
    },
    /**
     * @description Преобразование файла в css, содержащий base64-энкодированное содержание файла
     * @param {Object} file данные файла
     * @returns {String}
     */
    _toBase64: function(file) {
        var type = file.ext.substr(1);
        if (type === 'svg') {
            type = 'svg+xml';
        }
        var content = 'data:image/' + type + ';base64,' + file.data.toString('base64');

        if (content.length > (this.getOption('maxDataURISize') || 32000)) {
            throw new RangeError('Max DataURI length was exceeded on file "' + file.filename + '"');
        }

        return '/* ' + file.filename + ' *' + '/\n' +
            this._getSelector(file) + ' {background-image:url(' + content + ');}';
    },
    /**
     * @description Преобразование svg-файла в css, содержащий энкодированное содержание файла
     * @param {Object} file данные файла
     * @returns {String}
     */
    _toEncode: function(file) {
        // HOME-27561
        var type = file.ext.substr(1);

        if (type === 'svg') {
            var content = 'data:image/svg+xml;charset=utf8,',
                data = file.data.toString('utf8');

            data = data.replace(/"/g, '\'')
                      .replace(/%/g, '%25')
                      .replace(/</g, '%3C')
                      .replace(/>/g, '%3E')
                      .replace(/&/g, '%26')
                      .replace(/#/g, '%23')
                      .replace(/\s+/g, ' ');

            return '/* ' + file.filename + ' *' + '/\n' +
                this._getSelector(file) + ' {background-image:url("' + content + data + '");}';
        } else {
            return this._toBase64(file);
        }
    },
    /**
     * @description Преобразование файла в css, содержащий ссылку на файл
     * @param {Object} file данные файла
     * @returns {String}
     */
    _toLink: function(file) {
        return '/* ' + file.filename + ' *' + '/\n' +
            this._getSelector(file) + ' {background-image:url(' + file.filename + ');}';
    },
    /**
     * @description Преобразование файла в css, содержащий ссылку на файл в фильтре для ie6
     * @param {Object} file данные файла
     * @returns {String}
     */
    _toFilter: function(file) {
        return '/* ' + file.filename + ' *' + '/\n' +
            this._getSelector(file) + ' {background:none !important;-filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src=' +
            file.filename + ',sizingMethod=\'crop\');}';
    },
    /**
     * @param {Object} file
     * @returns {String} селектор для файла
     */
    _getSelector: function(file) {
        var re = new RegExp(('(.' + this.getOption('sourcesSuffix') + ')?' + file.ext + '$').replace(/\./g, '\\.'));
        return this._selectorPrefix + file.name.replace(re, '');
    },
    /**
     * @description Добавляет fallbackPrefix к селектору
     */
    _applyFallbackSelectorPrefix: function() {
        this._selectorPrefix = (this.getOption('fallbackPrefix') || '.i-ua_svg_no') + ' ' + this._selectorPrefix;
    },
    /**
     * @description Восстанавливает селектор
     */
    _resetSelectorPrefix: function() {
        this._selectorPrefix = this.getOption('selectorPrefix') || '.';
    },
    /**
     * @decription Сохраняет в кэш enb информацию о цели и её источниках
     * @param {String} target
     * @param {String} targetFilename путь до файла цели на диске
     * @param {String} list список файлов источников
     */
    _saveCache: function(target, targetFilename, list) {
        var cache = this.node.getNodeCache(target),
            filterProps = {'data': 1, 'readPromise': 1};
        cache.cacheFileInfo('target', targetFilename);
        cache.cacheFileList('list', list.map(function(file) {
            var res = {};
            for (var prop in file) {
                if (file.hasOwnProperty(prop) && !(prop in filterProps)) {
                    res[prop] = file[prop];
                }
            }
            return res;
        }));
    }
});
