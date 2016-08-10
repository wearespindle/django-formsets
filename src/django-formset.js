'use strict';

class Formset {

    constructor(selector, options) {
        this.selector = selector;
        this.options = options;
        this.flatExtraClasses = options.extraClasses.join(' ');
        this.deleteButtonEvents();
        if (selector.length) {
            this.addButtonEvent();
        }
    }


    deleteButtonEvents() {
        this.selector.each((i, el) => {
            let formsetElement = $(el);
            this.replaceCheckboxes(formsetElement);
            if (this.hasChildElements(formsetElement)) {
                // Add click events to the delete buttons.
                formsetElement.find(`a.${this.options.deleteCssClass}`).click((e) => {
                    let _row = $(e.currentTarget).closest(`.${this.options.formCssClass}`);
                    let _del = _row.find('input:hidden[id $= "-DELETE"]');

                    // If a pre-delete callback was provided, call it with the formsetElement and all forms:
                    // To prevent deletion return false
                    if (this.options.beforeDelete) {
                        if (this.options.beforeDelete(_del, _row, $(`.${this.options.formCssClass}:visible`))) {
                            this.deleteRow(_del, _row);
                        }
                    } else {
                        this.deleteRow(_del, _row);
                    }
                    if (this.options.keepFirst) {
                        if ($(`.${this.options.formCssClass}:visible`).length === 1) {
                            this.disableFirstDeleteLink();
                        }
                    }
                    return false;
                });

                formsetElement.addClass(this.options.formCssClass);
                this.applyExtraClasses(formsetElement, i);
            }
        });
    }


    replaceCheckboxes(formsetElement) {
        let del = formsetElement.find('input:checkbox[id $= "-DELETE"]');
        // Replace default formset checkboxes with hidden fields.
        if (del.length) {
            del.before(`<input type="hidden" name="${del.attr('name')}" id="${del.attr('id')}" />`);
            del.remove();
        }
    }


    enableDeleteLinks() {
        $(`.${this.options.formCssClass}`).find('.delete-row').removeClass('disabled');
    }


    disableFirstDeleteLink() {
        $(`.${this.options.formCssClass}:visible:first`).find(`.${this.options.deleteCssClass}`).addClass('disabled');
    }


    /**
     * Make a clone of the last formset and return it.
     */
    cloneFormset() {
        let template = $(`.${this.options.formCssClass}:last`).clone(true).removeAttr('id');
        template.find('input:hidden[id $= "-DELETE"]').remove();
        template.find(`.${this.options.errorCssClass}`).remove();
        template.find('input,select,textarea,label').each(function(i, el) {
            // If this is a checkbox or radiobutton, uncheck it.
            // This fixes Issue 1, reported by Wilson.Andrew.J:
            if ($(el).is('input:checkbox') || $(el).is('input:radio')) {
                $(el).attr('checked', false);
            } else {
                $(el).val('');
            }
        });
        return template;
    }


    addButtonEvent() {
        let addButton;

        this.options.formTemplate = this.cloneFormset();
        // Hide the first formset on init, when there is only one formset and
        // keepFirst is true.
        if (this.options.keepFirst && $(`.${this.options.formCssClass}:visible`).length === 1) {
            this.disableFirstDeleteLink();
        }


        if (this.selector.prop('tagName') === 'TR') {
            // Insert the `add` button in a new table row if forms are laid out as table rows.
            let numCols = this.selector.eq(0).children().length;
            this.selector.parent().append(`<tr><td class="django-formset-add td" colspan="${numCols}"><a class="${this.options.addCssClass}" href="javascript:void(0)">${this.options.addText}</a></tr>`);
            addButton = this.selector.parent().find('tr:last a');
            addButton.parents('tr').addClass(`${this.options.formCssClass}-add`);
        } else {
            // Otherwise, insert it immediately after the last form in a div.
            this.selector.filter(':last').after(`<div class="django-formset-add div"><a class="${this.options.addCssClass}" href="javascript:void(0)">${this.options.addText}</a></div>`);
            addButton = this.selector.filter(':last').next();
        }

        addButton.click((e) => {
            let totalForms = parseInt($(`#id_${this.options.prefix}-TOTAL_FORMS`).val(), 10);
            let formsetElement = this.options.formTemplate.clone(true);
            let buttonRow = $(e.currentTarget).parents(`tr.${this.options.formCssClass}-add`).get(0) || e.currentTarget;
            let forms = $(`.${this.options.formCssClass}`);
            // If a pre-add callback was provided, call it with the row and all forms:
            // To prevent adding return false
            if (this.options.beforeAdd) {
                if (this.options.beforeAdd(formsetElement, $(`.${this.options.formCssClass}:visible`).length, buttonRow, forms)) {
                    this.addRow(formsetElement, totalForms, buttonRow);
                }
            } else {
                this.addRow(formsetElement, totalForms, buttonRow);
            }

            // Check if the first formset should have a delete button again.
            // Unhide all, because inline styling is copied for new formsets.
            if (this.options.keepFirst && $(`.${this.options.formCssClass}:visible`).length > 1) {
                this.enableDeleteLinks();
            }
            return false;
        });
    }


    applyExtraClasses(formsetElement, ndx) {
        if (this.options.extraClasses) {
            formsetElement.removeClass(this.flatExtraClasses);
            formsetElement.addClass(this.options.extraClasses[ndx % this.options.extraClasses.length]);
        }
    }


    updateElementIndex(elem, prefix, ndx) {
        let idRegex = new RegExp('(' + prefix + '-\\d+-)|(^)');
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


    hasChildElements(formsetElement) {
        return formsetElement.find('input,select,textarea,label').length > 0;
    }


    addRow(formsetElement, formCount, buttonRow) {
        this.applyExtraClasses(formsetElement, formCount);
        formsetElement.insertBefore($(buttonRow)).show();
        formsetElement.find('input,select,textarea,label').each((i, el) => {
            this.updateElementIndex($(el), this.options.prefix, formCount);
        });
        $(`#id_${this.options.prefix}-TOTAL_FORMS`).val(formCount + 1);
        // If a post-add callback was supplied, call it with the added form:
        if (this.options.added) this.options.added(formsetElement);
    }


    deleteRow(del, formsetElement) {
        if (del.length) {
            // We're dealing with an inline formset; rather than remove
            // this form from the DOM, we'll mark it as deleted and hide
            // it, then let Django handle the deleting:
            del.val('on');
            formsetElement.hide();
        } else {
            formsetElement.remove();
            let forms = $(`.${this.options.formCssClass}`);
            // Update the TOTAL_FORMS form count.
            // Also update names and IDs for all remaining form controls so they remain in sequence:
            $(`#id_${this.options.prefix}-TOTAL_FORMS`).val(forms.length);
            for (let i = 0, formCount = forms.length; i < formCount; i++) {
                this.applyExtraClasses(forms.eq(i), i);
                forms.eq(i).find('input,select,textarea,label').each((_i, el) => {
                    this.updateElementIndex($(el), this.options.prefix, i);
                });
            }
        }
        // If a post-delete callback was provided, call it with the deleted form:
        if (this.options.deleted) this.options.deleted(formsetElement);
    }
}

$.fn.formset = function(opts) {
    let selector = $(this);
    new Formset(selector, $.extend({}, $.fn.formset.defaults, opts));
    return selector;
};

/* Setup plugin defaults */
$.fn.formset.defaults = {
    prefix: 'form',                  // The form prefix for your django formset
    formTemplate: null,              // The jQuery selection cloned to generate new form instances
    addText: '<i class="icon-plus-sign icon-large"></i>',
    deleteText: '<i class="icon-remove-sign icon-large"></i>',
    addCssClass: 'add-row',          // CSS class applied to the add link
    deleteCssClass: 'delete-row',    // CSS class applied to the delete link
    formCssClass: 'dynamic-form',    // CSS class applied to each form in a formset
    extraClasses: [],                // Additional CSS classes, which will be applied to each form in turn
    beforeAdd: null,                 // Function called each time before a new form is added
    beforeDelete: null,              // Function called each time before a form is deleted
    added: null,                     // Function called each time a new form is added
    deleted: null,                   // Function called each time a form is deleted
    errorCssClass: 'errorlist',     // CSS class that will be ignored when cloning formTemplate
};
