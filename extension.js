// ref https://github.com/ipython-contrib/jupyter_contrib_nbextensions/issues/664
// for events list
define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'notebook/js/codecell',
], function (
    requirejs,
    $,
    Jupyter,
    events,
    codecell,
) {
    "use strict";

    var mod_name = 'ExemplifiedOutput';
    var log_prefix = '[' + mod_name + ']';
    let CodeCell = codecell.CodeCell;

    // define default values for config parameters
    var params = {
    };

    function add_exemplified_output_converter_button(cell) {
        let output_area_el = cell.element.find('.output_subarea');
        if(output_area_el.find('button.exemplify_output-convert').length > 0) {
            return;
        }
        output_area_el.prepend(
            $('<button/>')
                .addClass('exemplify_output-convert')
                .on('click', function(evt) {
                    $.extend(true, cell.metadata, {
                        ExemplifiedOutput: {
                            content: cell.output_area.outputs[0].text,
                            timestamp: new Date().toISOString()
                        }
                    });
                    update_exemplified_output_display(cell);
                })
                .text('convert to example output')
        );
    }

    function patch_CodeCell_get_callbacks () {
        console.log(log_prefix, 'patching CodeCell.prototype.get_callbacks');
        var old_get_callbacks = CodeCell.prototype.get_callbacks;
        CodeCell.prototype.get_callbacks = function () {
            var callbacks = old_get_callbacks.apply(this, arguments);

            var cell = this;
            var prev_reply_callback = callbacks.shell.reply;
            callbacks.shell.reply = function (msg) {
                if (msg.msg_type === 'execute_reply') {
                    add_exemplified_output_converter_button(cell)
                }
                else {
                    console.log('msg_type', msg.msg_type);
                }
                return prev_reply_callback(msg);
            };
            return callbacks;
        };
    }

    function update_exemplified_output_display (cell) {
        if (! (cell instanceof CodeCell) ||
                 !cell.metadata.ExemplifiedOutput ||
                 !cell.metadata.ExemplifiedOutput.content) {
            return $();
        }

        add_exemplified_output_converter_button(cell);
        cell.element.find('.exemplify_output-example-output').remove();
        var exemplified_output = $('<div/>')
            .addClass('exemplify_output-example-output')
            .addClass('output_text output_stream output_stdout')
            .insertAfter(cell.element.find('.output_area .prompt'));
        let container = $('<div/>')
            .addClass('exemplify_output-label-container')
            .append($('<span/>')
                .addClass('exemplify_output-label')
                .text('EXAMPLE from ' + cell.metadata.ExemplifiedOutput.timestamp))
        exemplified_output
            .append(container)
            .append($('<pre/>').text(
                cell.metadata.ExemplifiedOutput.content))

        return exemplified_output;
    }

    function update_all_example_output () {
        console.debug('%c' + log_prefix + 'updating all examples areas', 'color: white; background: black;');
        Jupyter.notebook.get_cells().forEach(update_exemplified_output_display);
    }

    var initialize = function () {
        // update params with any specified in the server's config file.
        // the "thisextension" value of the Jupyter notebook config's
        // data may be undefined, but that's ok when using JQuery's extend
        $.extend(true, params, Jupyter.notebook.config.thisextension);
		patch_CodeCell_get_callbacks();

        // HACK HACK HACK
        // after triggering a cell execution, the output area is immediately
        // cleared.  in order to keep the example visible, we must trigger a
        // re-render after re-divining the cell for the output_area object.
		// for other interesting events,
		// see site-packages/notebook/static/notebook/js/outputarea.js etc
        // and search for events.trigger
        // - execute.CodeCell
        events.on('output_added.OutputArea', function(evt, data) {
            var cell = data.output_area.element.parent().parent().data('cell')
            update_exemplified_output_display(cell);
        });

        // add our extension's css to the page
        $('<link/>')
            .attr({
                rel: 'stylesheet',
                type: 'text/css',
                href: requirejs.toUrl('./style.css')
            })
            .appendTo('head');
    };

    // The specially-named function load_ipython_extension will be called
    // by the notebook when the nbextension is to be loaded.
    // It mustn't take too long to execute however, or the notebook will
    // assume an error has occurred.
    var load_ipython_extension = function () {
        // Once the config has been loaded, do everything else.
        // The loaded object is a javascript Promise object, so the then
        // call return immediately. See
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise
        // for details.
        return Jupyter.notebook.config.loaded.then(initialize).then(update_all_example_output);
    };

    // return object to export public methods
    return {
        load_ipython_extension : load_ipython_extension
    };
});
