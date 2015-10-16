var React = require('react');
var Marked = require('marked');
var $ = require('jquery');

var SqlDoc = React.createClass({displayName: "SqlDoc",

    componentDidMount: function(){
        React.findDOMNode(this).addEventListener('scroll', this.scrollHandler);
    },

    componentWillUnmount: function(){
        React.findDOMNode(this).removeEventListener('scroll', this.scrollHandler);
    },

    getRenderer: function(query){
        if (this.props.output == 'script'){
            return this.renderDataset;
        } else {
            if (query.match('^\\s*---\\s+chart\s*.*') != null){
                return this.renderChart;
            } else {
                return this.renderDataset;
            }
        }
    },

    markdown: function(str){
        var renderer = new Marked.Renderer();
        renderer.link = function(href, title, text){
            return '<a href="#" onClick="openExternal(\''+href+'\');">'+text+'</a>'
        };
        return Marked(str, {renderer: renderer});
    },

    getHeader: function(query){
        var cut = query.replace(/^\s*---.*[\s\n]*/, ''); 
        var match = cut.match('^\s*/\\*\\*([\\s\\S]*?)\\*\\*/');
        if (match != null && match.length == 2){
            return React.createElement("div", {className: "markdown-block", dangerouslySetInnerHTML: {__html: this.markdown(match[1])}});
        } else {
            return null;
        }
    },

    getFooter: function(query){
        var idx = query.lastIndexOf('/**');
        var idx0 = query.indexOf('/**');
        var check = query.replace(/^\s*---.*[\s\n]*/, ''); 
        if (check.substr(0,3) == '/**' && idx == idx0){ // a single markdown passed, already generated as a header so pass by
            return null;
        }
        var cut = query.substr(idx);
        var match = cut.match('/\\*\\*([\\s\\S]*?)\\*\\*/[\\s\\r\\n]*$');
        if (match != null && match.length == 2){
            return React.createElement("div", {className: "markdown-block", dangerouslySetInnerHTML: {__html: this.markdown(match[1])}});
        } else {
            return null;
        }
    },

    render: function(){
        
        var self = this;
        var blocks = [];
        var duration = 0;

        // button bar
        if (this.props.buttonBar == true){
            var buttonBar = React.createElement("div", {className: "duration-div"}, 
                React.createElement("table", {className: "duration-table"}, 
                React.createElement("tr", null, 
                React.createElement("td", null, React.createElement("span", {className: "duration-word"}, "Time:"), " ", React.createElement("span", {className: "duration-number"}, duration), " ", React.createElement("span", {className: "duration-word"}, "ms")), 
                React.createElement("td", null, React.createElement("button", {type: "button", className: "btn btn-info", onClick: this.props.onShare}, "share"))
                )
                )
                );
        } else {
            var buttonBar = null;
        }

        // document blocks
        this.rendered_records = {};
        for (var block_idx = 0; block_idx < this.props.data.length; block_idx++){
            
            duration += this.props.data[block_idx].duration;
            
            var renderer = this.getRenderer(this.props.data[block_idx].query);
            var datasets = this.props.data[block_idx].datasets.map(function(dataset, i){
                var dsid = self.dsid(block_idx, i);
                self.rendered_records[dsid] = 0;
                return renderer(block_idx, dataset, i, self.props.data[block_idx].query);
            });

            var header = this.getHeader(this.props.data[block_idx].query);
            var footer = this.getFooter(this.props.data[block_idx].query);

            block = React.createElement("div", {key: "block_"+block_idx}, header, datasets, footer);
            blocks.push(block);
        }

        return (
            React.createElement("div", {className: "output-console"}, 
                buttonBar, 
                blocks
            )
        );

        return React.createElement("div", null)
    },

    dsid: function(block_idx, dataset_idx){
        return this.props.eventKey+"_"+block_idx+"_"+dataset_idx;
    },

    renderChart: function(block_idx, dataset, i, query){

        if (['PGRES_FATAL_ERROR', 'PGRES_BAD_RESPONSE'].indexOf(dataset.resultStatus) > -1) {
            return React.createElement("div", {key: 'err_'+i, className: "query-error alert alert-danger"}, dataset.resultErrorMessage.toString());
        }

        var chart_type = query.match('^\\s*---\\s+chart\\s+([a-z\\-]*)')[1];
        var chart_args = query.match('^\\s*---\\s+chart\\s+[a-z\\-]*\\s*(.*)\\n')[1];

        if (chart_type == ''){
            chart_type = 'line';
        }
        var chart_id = 'chart_'+this.props.eventKey+'_'+i;

        var hidden_value = '<input id="data_'+chart_id+'" type="hidden" value="'+encodeURIComponent(JSON.stringify(dataset))+'"></input>';

        return(

            React.createElement("div", {
                "data-chart-id": chart_id, 
                "data-chart-type": chart_type, 
                "data-chart-args": chart_args, 
                dangerouslySetInnerHTML: {__html: hidden_value}})

        );
    },

    limit_ref: function(dsid){
        return "limit_"+dsid;
    },

    limit_item: function(dsid){
        return $("#"+this.limit_ref(dsid));
    },

    renderRecord: function(block_idx, dataset_idx, record_idx){
        fields = [React.createElement("td", {key: 'col_rownum_'+this.props.eventKey+'_'+dataset_idx+'_'+record_idx}, record_idx+1)];
        var row = this.props.data[block_idx].datasets[dataset_idx].data[record_idx];
        for (var column_idx=0; column_idx < row.length; column_idx++){
            var val = row[column_idx];
            fields.push(
                React.createElement("td", {key: 'col_'+this.props.eventKey+'_'+dataset_idx+'_'+record_idx+'_'+column_idx}, 
                    val
                )
            );
        }
        return React.createElement("tr", {key: 'row_'+this.props.eventKey+'_'+dataset_idx+'_'+record_idx}, fields);
    },

    renderStaticRecord: function(block_idx, dataset_idx, record_idx){
        // generating text html is much faster than using react
        fields = '<td>'+(record_idx+1)+'</td>';
        var row = this.props.data[block_idx].datasets[dataset_idx].data[record_idx];
        for (var column_idx=0; column_idx < row.length; column_idx++){
            var val = row[column_idx];
            fields += '<td>'+val+'</td>';
        }
        return '<tr>'+fields+'</tr>';
    },

    renderDataset: function(block_idx, dataset, dataset_idx, query){

        var dsid = this.dsid(block_idx, dataset_idx);

        if (dataset.resultStatus == 'PGRES_COMMAND_OK'){
            return React.createElement("div", {key: 'cmdres_'+dsid, className: "alert alert-success"}, dataset.cmdStatus);
        } else if (['PGRES_FATAL_ERROR', 'PGRES_BAD_RESPONSE'].indexOf(dataset.resultStatus) > -1) {
            return React.createElement("div", {key: 'err_'+dsid, className: "query-error alert alert-danger"}, dataset.resultErrorMessage.toString());
        } else if (dataset.resultStatus == 'PGRES_NONFATAL_ERROR') {
            return React.createElement("div", {key: 'err_'+dsid, className: "query-error alert alert-info"}, dataset.resultErrorMessage.toString());
        }

        var fields = dataset.fields;
        var rows = dataset.data;

        if (fields.length == 0){
            return null;
        }

        if (fields){
            var out_fields = fields.map(function(field, i){
                return (React.createElement("th", {key: 'field_'+i}, field.name));
            });
        };

        var out_rows = [];
        var omitted_count = 0;
        var limit = Math.min(100, rows.length-this.rendered_records[dsid]); // render only 1st 100 records, the rest render on scroll

        for (var i=this.rendered_records[dsid]; i <= limit; i++){

            if (i == limit){
                if (i<rows.length){
                    var omitted_count = rows.length - this.rendered_records[dsid] + 1;
                    var omitted_message = React.createElement("span", {id: this.limit_ref(dsid), className: "omitted-message"}, omitted_count, " more ");
                }
                break;
            }

            var row = this.renderRecord(block_idx, dataset_idx, i);
            this.rendered_records[dsid] = this.rendered_records[dsid] + 1;

            out_rows.push(row);
        }

        if (omitted_count > 0){
            out_rows.push(
                React.createElement("tr", null, 
                    React.createElement("td", {colSpan: fields.length+1}, omitted_message)
                )
            );
        }

        if (dataset.nrecords == 1){
            rword = 'row';
        } else {
            rword = 'rows';
        }
        
        return (

            React.createElement("div", {key: 'dataset_'+dsid}, 
                React.createElement("div", {className: "rows-count-div"}, 
                React.createElement("span", {className: "rows-count-bracket"}, "("), 
                React.createElement("span", {className: "rows-count-number"}, dataset.nrecords), " ", React.createElement("span", {className: "rows-count-word"}, rword), 
                React.createElement("span", {className: "rows-count-bracket"}, ")")
                ), 

                React.createElement("table", {key: 'dataset_'+dsid, className: "table-resultset table table-hover"}, 
                React.createElement("thead", null, 
                    React.createElement("tr", null, 
                    React.createElement("th", {className: "rownum"}, "#"), 
                    out_fields
                    )
                ), 
                React.createElement("tbody", null, 
                out_rows
                )
                )
            )
        );
    },

    scrollHandler: function(e){
        var container = $(React.findDOMNode(this));
        for (var block_idx=0; block_idx < this.props.data.length; block_idx++){
            for (var dataset_idx=0; dataset_idx < this.props.data[block_idx].datasets.length; dataset_idx++){

                var dsid = this.dsid(block_idx, dataset_idx);
                var rendered = this.rendered_records[dsid];
                var len = this.props.data[block_idx].datasets[dataset_idx].data.length;
                if (rendered == len){
                    continue;
                }

                var limit_item = this.limit_item(dsid);

                if (typeof(limit_item) != 'undefined' && typeof(container) != 'undefined'){

                    var offset = limit_item.offset().top - container.offset().top - container.height();
                    if (offset < 0){
                        this.renderNext(block_idx, dataset_idx);
                    }
                }
            }
        }
    },

    renderNext: function(block_idx, dataset_idx){
        var dsid = this.dsid(block_idx, dataset_idx);
        var rendered = this.rendered_records[dsid];
        var len = this.props.data[block_idx].datasets[dataset_idx].data.length;
        var limit = Math.min(rendered+500, len);
        var limit_item = this.limit_item(dsid);

        if (rendered == len){
            return;
        }

        var insert_html = '';
        for (var i = rendered; i<limit; i++){
            this.rendered_records[dsid] = this.rendered_records[dsid] + 1;

            var row_html = this.renderStaticRecord(block_idx, dataset_idx, i);

            insert_html += row_html;
        }
        
        if (insert_html != ''){
            limit_item.closest('TR').before(insert_html);
        }

        if (this.rendered_records[dsid] == len){
            limit_item.remove();
        } else {
            var rest = len-this.rendered_records[dsid];
            limit_item.text(rest+' more');
        }
    },


});

module.exports = SqlDoc;
