/*
 * RailsAdmin simple multiselect
 *
 * Based on original filtering-multiselect widget but edited
 * to simplify it (e.g. removing the first select menu)
 * License
 *
 * http://www.railsadmin.org
 *
 * Depends:
 *   jquery.ui.core.js
 *   jquery.ui.widget.js
 */
(function($) {
  $.widget("ra.simpleMultiselect", {
    _cache: {},
    options: {
      createQuery: function(query) {
        return { query: query };
      },
      sortable: false,
      removable: true,
      regional: {
        up: "Up",
        down: "Down",
        add: "Add",
        chooseAll: "Choose all",
        chosen: "Chosen records",
        clearAll: "Clear all",
        remove: "Remove"
      },
      searchDelay: 400,
      remote_source: null,
      xhr: false
    },

    _create: function() {
      this._cache = {};
      this._build();
      this._buildCache();
      this._bindEvents();
    },

    _build: function() {
      var i;

      this.wrapper = $('<div class="ra-multiselect">');

      this.wrapper.insertAfter(this.element);

      this.header = $('<div class="ra-multiselect-header ui-helper-clearfix">');

      this.wrapper.append(this.header);

      this.columns = {
        right: $('<div class="ra-multiselect-column ra-multiselect-right">')
      };

      for (i in this.columns) {
        if (this.columns.hasOwnProperty(i)) {
          this.wrapper.append(this.columns[i]);
        }
      }

      this.collection = $('<select multiple="multiple"></select>');

      this.collection.addClass("form-control ra-multiselect-collection");
      this.collection.wrap('<div class="wrapper"/>');

      if (this.options.sortable) {
        this.up = $('<a href="#" class="ui-icon ui-icon-circle-triangle-n ra-multiselect-item-up">' + this.options.regional.up + '</a>');
        this.down = $('<a href="#" class="ui-icon ui-icon-circle-triangle-s ra-multiselect-item-down">' + this.options.regional.down + '</a>');
        this.columns.center.append(this.up).append(this.down);
      }

      this.selection = $('<select class="form-control ra-multiselect-selection" multiple="multiple"></select>');
      this.columns.right.append(this.selection);

      this.selection.wrap('<div class="wrapper"/>');

      if (this.options.removable) {
        this.remove = $('<br/><a style="margin-left:10px; margin-top:5px;" href="#" class="ra-multiselect-item-remove btn btn-danger"><i class=\"icon-plus icon-minus\"></i></a>');
        help_block = this.wrapper.parent().find('.help-block')[0];
        this.remove.insertBefore(help_block)
      }



      this.element.css({display: "none"});

      this.tooManyObjectsPlaceholder = $('<option disabled="disabled" />').text(RailsAdmin.I18n.t("too_many_objects"));
      this.noObjectsPlaceholder = $('<option disabled="disabled" />').text(RailsAdmin.I18n.t("no_objects"))

      if(this.options.xhr){
        this.collection.append(this.tooManyObjectsPlaceholder);
      }
    },

    _bindEvents: function() {
      var widget = this;

      if (this.options.removable) {
        this.remove.click(function(e){
          selected_id = $(':selected', widget.selection)[0].value
          title = $(':selected', widget.selection)[0].title
          model_name = this.options.model_name
          delete_path = Routes.rails_admin_delete_path(model_name, selected_id)

          var answer = confirm ("Are you sure you want to delete '" + title + "' ?");
          if (answer)
          {
            $.ajax({
                type: "POST",
                url: delete_path,
                dataType: "json",
                data: {"_method":"delete"},
                complete: function(){
                    widget._deSelect($(':selected', widget.selection));
                },
                error: function() {
                  alert("Error: Could not delete dimension, please try again")
                }
            });

          }
          e.preventDefault();
        }.bind(this));
      }

      var timeout = null;
      if(this.options.sortable) {
        /* Move selection up */
        this.up.click(function(e){
          widget._move('up', $(':selected', widget.selection));
          e.preventDefault();
        });

        /* Move selection down */
        this.down.click(function(e){
          widget._move('down', $(':selected', widget.selection));
          e.preventDefault();
        });
      }

      /* Typing to the filter */
      // this.filter.bind('keyup click', function(e){
      //   if (timeout) { clearTimeout(timeout); }
      //   timeout = setTimeout(function() {
      //       widget._queryFilter(widget.filter.val());
      //     }, widget.options.searchDelay
      //   );
      // });
    },

    _queryFilter: function(val) {
      var widget = this;
      widget._query(val, function(matches) {
        var i;
        var filtered = [];
        for (i in matches) {
          if (matches.hasOwnProperty(i) && !widget.selected(matches[i].id)) {
            filtered.push(i);
          }
        }
        if (filtered.length > 0) {
          widget.collection.html('');
          for (i in filtered) {
            widget.collection.append(
              $('<option></option>').attr('value', matches[filtered[i]].id).attr('title', matches[filtered[i]].label).text(matches[filtered[i]].label)
            );
          }
        } else {
          widget.collection.html(widget.noObjectsPlaceholder);
        }
      });
    },

    /*
     * Cache key is stored in the format `o_<option value>` to avoid JS
     * engine coercing string keys to int keys, and thereby preserving
     * the insertion order. The value for each key is in turn an object
     * that stores the option tag's HTML text and the value. Example:
     * cache = {
     *    'o_271': { id: 271, value: 'CartItem #271'},
     *    'o_270': { id: 270, value: 'CartItem #270'}
     * }
     */
    _buildCache: function(options) {
      var widget = this;

      this.element.find("option").each(function(i, option) {
        if (option.selected) {
          widget._cache['o_' + option.value] = {id: option.value, value: option.innerHTML};
          $(option).clone().appendTo(widget.selection).attr("selected", false).attr("title", $(option).text());
        } else {
          widget._cache['o_' + option.value] = {id: option.value, value: option.innerHTML};
          $(option).clone().appendTo(widget.collection).attr("selected", false).attr("title", $(option).text());
        }
      });
    },

    _deSelect: function(options) {
      var widget = this;
      options.each(function(i, option) {
        widget.element.find('option[value="' + option.value + '"]').removeAttr("selected");
      });
      $(options).appendTo(this.collection).attr('selected', false);
    },

    _query: function(query, success) {

      var i, matches = [];

      if (query === "") {

        if (!this.options.xhr) {
          for (i in this._cache) {
            if (this._cache.hasOwnProperty(i)) {
              option = this._cache[i];
              matches.push({id: option.id, label: option.value});
            }
          }
          success.apply(this, [matches]);
        } else {
          this.collection.html(this.tooManyObjectsPlaceholder);
        }

      } else {

        if (this.options.xhr) {

          $.ajax({
            beforeSend: function(xhr) {
              xhr.setRequestHeader("Accept", "application/json");
            },
            url: this.options.remote_source,
            data: this.options.createQuery(query),
            success: success
          });

        } else {

          query = new RegExp(query + '.*', 'i');

          for (i in this._cache) {
            if (this._cache.hasOwnProperty(i) && query.test(this._cache[i]['value'])) {
              option = this._cache[i];
              matches.push({id: option.id, label: option.value});
            }
          }

          success.apply(this, [matches]);
        }
      }
    },

    _select: function(options) {
      var widget = this;
      options.each(function(i, option) {
        var el = widget.element.find('option[value="' + option.value + '"]');
        if (el.length) {
          el.attr("selected", "selected");
        } else {
          widget.element.append($('<option></option>').attr('value', option.value).attr('selected', "selected"));
        }
      });
      $(options).appendTo(this.selection).attr('selected', false);
    },

    _move: function(direction, options) {
      var widget = this;
      if(direction == 'up') {
        options.each(function(i, option) {
          var prev = $(option).prev();
          if (prev.length > 0) {
            var el = widget.element.find('option[value="' + option.value + '"]');
            var el_prev = widget.element.find('option[value="' + prev[0].value + '"]');
            el_prev.before(el);
            prev.before($(option));
          }
        });
      } else {
        $.fn.reverse = [].reverse; // needed to lower last items first
        options.reverse().each(function(i, option) {
          var next = $(option).next();
          if (next.length > 0) {
            var el = widget.element.find('option[value="' + option.value + '"]');
            var el_next = widget.element.find('option[value="' + next[0].value + '"]');
            el_next.after(el);
            next.after($(option));
          }
        });
      }
    },

    selected: function(value) {
      return this.element.find('option[value="' + value + '"]').attr("selected");
    },

    destroy: function() {
      this.wrapper.remove();
      this.element.css({display: "inline"});
      $.Widget.prototype.destroy.apply(this, arguments);
    }
  });
})(jQuery);

$(document).on('rails_admin.dom_ready', function(e, content) {
  content = content ? content : $('form');
  content.find('[data-simplemultiselect]').each(function() {
    $(this).simpleMultiselect($(this).data('options'));
    if ($(this).parents("#modal").length) {
      return $(this).siblings('.btn').remove();
    } else {
      return $(this).parents('.control-group').first().remoteForm();
    }
  });
});
