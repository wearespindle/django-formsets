'use strict';


class DjangoFormset {

    constructor(options) {
        this.options = options;
        this.childElementSelector = 'input,select,textarea,label,div';
        this.flatExtraClasses = options.extraClasses.join(' ');
        this.totalForms = $('#id_' + options.prefix + '-TOTAL_FORMS');
        this.maxForms = $('#id_' + options.prefix + '-MAX_NUM_FORMS');
        this.minForms = $('#id_' + options.prefix + '-MIN_NUM_FORMS');
    }


    applyExtraClasses(row, ndx) {
        if (this.options.extraClasses) {
            row.removeClass(this.flatExtraClasses);
            row.addClass(this.options.extraClasses[ndx % this.options.extraClasses.length]);
        }
    }


    updateElementIndex(elem, prefix, ndx) {
        let idRegex = new RegExp(prefix + '-(\\d+|__prefix__)-');
        let replacement = prefix + '-' + ndx + '-';
        if (elem.attr('for')) {
            elem.attr('for', elem.attr('for').replace(idRegex, replacement));
        }
        if (elem.attr('id')) {
            elem.attr('id', elem.attr('id').replace(idRegex, replacement));
        }
        if (elem.attr('name')) {
            elem.attr('name', elem.attr('name').replace(idRegex, replacement));
        }
    }


    hasChildElements(row) {
        return row.find(this.childElementSelector).length > 0;
    }


    showAddButton() {
        return this.maxForms.length === 0 || (this.maxForms.val() === '' || (this.maxForms.val() - this.totalForms.val() > 0));
    }


    /**
     * Indicates whether delete link(s) can be displayed when
     * total forms > min forms.
     */
    showDeleteLinks() {
        return this.minForms.length === 0 || (this.minForms.val() === '' || (this.totalForms.val() - this.minForms.val() > 0));
    }


    insertDeleteLink(row) {
        let delCssSelector = $.trim(this.options.deleteCssClass).replace(/\s+/g, '.');
        let addCssSelector = $.trim(this.options.addCssClass).replace(/\s+/g, '.');
        if (row.is('TR')) {
            // Insert the remove button into the last table cell:If the forms are laid out in table rows,
            row.children(':last').append(`<a class="${this.options.deleteCssClass}" href="javascript:void(0)">${this.options.deleteText}</a>`);
        } else if (row.is('UL') || row.is('OL')) {
            // Insert an <li> after the last list item, if they're laid out as an ordered/unordered list.
            row.append(`<li><a class="${this.options.deleteCssClass}" href="javascript:void(0)">${this.options.deleteText}</a></li>`);
        } else {
            // Otherwise, just insert the remove button as the last child element of the form's container.
            row.append(`<a class="${this.options.deleteCssClass}" href="javascript:void(0)">${this.options.deleteText}</a>`);
        }
        // Check if we're under the minimum number of forms - not to display delete link at rendering.
        if (!this.showDeleteLinks()) {
            row.find(`a.${delCssSelector}`).hide();
        }

        // A formset delete button is clicked.
        row.find(`a.${delCssSelector}`).click((e) => {
            let forms;
            let _row = $(e.currentTarget).parents(`.${this.options.formCssClass}`);
            let del = _row.find('input:hidden[id $= "-DELETE"]');

            let buttonRow = _row.siblings(`a.${addCssSelector}, .${this.options.formCssClass}-add`);
            if (del.length) {
                // We're dealing with an inline formset.
                // Rather than remove this form from the DOM, we'll mark it as deleted
                // and hide it, then let Django handle the deleting:
                del.val('on');
                _row.hide();
                forms = $(`.${this.options.formCssClass}`).not(':hidden');
            } else {
                _row.remove();
                // Update the TOTAL_FORMS count:
                forms = $(`.${this.options.formCssClass}`).not('.formset-custom-template');
                this.totalForms.val(forms.length);
            }
            for (var i=0, formCount=forms.length; i<formCount; i++) {
                // Apply `extraClasses` to form rows so they're nicely alternating:
                this.applyExtraClasses(forms.eq(i), i);
                if (!del.length) {
                    // Also update names and IDs for all child controls (if this isn't
                    // a delete-able inline formset) so they remain in sequence:
                    forms.eq(i).find(this.childElementSelector).each((i, el) => {
                        this.updateElementIndex($(el), this.options.prefix, i);
                    });
                }
            }
            // Check if we've reached the minimum number of forms - hide all delete link(s)
            if (!this.showDeleteLinks()) {
                $(`a.${delCssSelector}`).each((_i, el) => {
                    $(el).hide();
                });
            }
            // Check if we need to show the add button:
            if (buttonRow.is(':hidden') && this.showAddButton()) {
                buttonRow.show();
            }
            // If a post-delete callback was provided, call it with the deleted form:
            if (this.options.removed) {
                this.options.removed(row);
            }
            return false;
        });
    }
}


$.fn.formset = function(opts) {
    let options = $.extend({}, $.fn.formset.defaults, opts);
    let $$ = $(this);
    let formset = new DjangoFormset(options);

    $$.each(function(i) {
        let row = $(this);
        let del = row.find('input:checkbox[id $= "-DELETE"]');
        if (del.length) {
            // If you specify "can_delete = True" when creating an inline formset,
            // Django adds a checkbox to each form in the formset.
            // Replace the default checkbox with a hidden field:
            if (del.is(':checked')) {
                // If an inline formset containing deleted forms fails validation, make sure
                // we keep the forms hidden (thanks for the bug report and suggested fix Mike)
                del.before(`<input type="hidden" name="${del.attr('name')}" id="${del.attr('id')}" value="on" />`);
                row.hide();
            } else {
                del.before(`<input type="hidden" name="${del.attr('name')}" id="${del.attr('id')}" />`);
            }
            // Hide any labels associated with the DELETE checkbox:
            $(`label[for="${del.attr('id')}"]`).hide();
            del.remove();
        }
        if (formset.hasChildElements(row)) {
            row.addClass(options.formCssClass);
            if (row.is(':visible')) {
                formset.insertDeleteLink(row);
                formset.applyExtraClasses(row, i);
            }
        }
    });

    if ($$.length) {
        let addButton, template;
        let hideAddButton = !formset.showAddButton();

        if (options.formTemplate) {
            // If a form template was specified, we'll clone it to generate new form instances:
            template = (options.formTemplate instanceof $) ? options.formTemplate : $(options.formTemplate);
            template.removeAttr('id').addClass(options.formCssClass + ' formset-custom-template');
            template.find(formset.childElementSelector).each(function() {
                formset.updateElementIndex($(this), options.prefix, '__prefix__');
            });
            formset.insertDeleteLink(template);
        } else {
            // Otherwise, use the last form in the formset; this works much better if you've got
            // extra (>= 1) forms (thnaks to justhamade for pointing this out):
            template = $('.' + options.formCssClass + ':last').clone(true).removeAttr('id');
            template.find('input:hidden[id $= "-DELETE"]').remove();
            // Clear all cloned fields, except those the user wants to keep (thanks to brunogola for the suggestion):
            template.find(formset.childElementSelector).not(options.keepFieldValues).each(function() {
                var elem = $(this);
                // If this is a checkbox or radiobutton, uncheck it.
                // This fixes Issue 1, reported by Wilson.Andrew.J:
                if (elem.is('input:checkbox') || elem.is('input:radio')) {
                    elem.attr('checked', false);
                } else {
                    elem.val('');
                }
            });
        }

        options.formTemplate = template;

        if ($$.is('TR')) {
            // If forms are laid out as table rows, insert the
            // "add" button in a new table row:
            let numCols = $$.eq(0).children().length;   // This is a bit of an assumption :|
            let buttonRow = $(`<tr><td colspan="${numCols}"><a class="${options.addCssClass}" href="javascript:void(0)">${options.addText}</a></tr>`)
                            .addClass(options.formCssClass + '-add');
            $$.parent().append(buttonRow);
            if (hideAddButton) {
                buttonRow.hide();
            }
            addButton = buttonRow.find('a');
        } else {
            // Otherwise, insert it immediately after the last form:
            $$.filter(':last').after(`<a class="${options.addCssClass}" href="javascript:void(0)">${options.addText}</a>`);
            addButton = $$.filter(':last').next();
            if (hideAddButton) addButton.hide();
        }

        addButton.click((e) => {
            if (options.beforeAdd) {
                options.beforeAdd();
            }
            let formCount = parseInt(formset.totalForms.val(), 10);
            let row = options.formTemplate.clone(true).removeClass('formset-custom-template');
            let buttonRow = $($(this).parents(`tr.${options.formCssClass}-add`).get(0) || this);
            let delCssSelector = $.trim(options.deleteCssClass).replace(/\s+/g, '.');
            formset.applyExtraClasses(row, formCount);
            row.insertBefore(buttonRow).show();
            row.find(formset.childElementSelector).each(function() {
                formset.updateElementIndex($(this), options.prefix, formCount);
            });
            formset.totalForms.val(formCount + 1);
            // Check if we're above the minimum allowed number of forms -> show all delete link(s)
            if (formset.showDeleteLinks()) {
                $(`a.${delCssSelector}`).each(function() {
                    $(this).show();
                });
            }
            // Check if we've exceeded the maximum allowed number of forms:
            if (!formset.showAddButton()) {
                buttonRow.hide();
            }
            // If a post-add callback was supplied, call it with the added form:
            if (options.added) {
                options.added(row);
            }

            return false;
        });
    }
    return $$;
};


// Setup plugin defaults.
$.fn.formset.defaults = {
    prefix: 'form',                  // The form prefix for your django formset
    formTemplate: null,              // The jQuery selection cloned to generate new form instances
    addText: 'add another',          // Text for the add link
    deleteText: 'remove',            // Text for the delete link
    addCssClass: 'add-row',          // CSS class applied to the add link
    deleteCssClass: 'delete-row',    // CSS class applied to the delete link
    formCssClass: 'dynamic-form',    // CSS class applied to each form in a formset
    extraClasses: [],                // Additional CSS classes, which will be applied to each form in turn
    keepFieldValues: '',             // jQuery selector for fields whose values should be kept when the form is cloned
    beforeAdd: null,                 // Function called each time before a new form is added
    beforeDelete: null,              // Function called each time before a form is deleted
    added: null,                     // Function called each time a new form is added
    removed: null,                   // Function called each time a form is deleted
};
