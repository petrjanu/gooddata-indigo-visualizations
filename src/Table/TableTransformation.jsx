import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { noop, pick } from 'lodash';

import Table from './Table';
import { getSortInfo, parseMetricValues } from './utils';
import DrillableItem from '../proptypes/DrillableItem';

export function renderTable(props) {
    return <Table {...props} />;
}

export default class TableTransformation extends Component {
    static propTypes = {
        afm: PropTypes.object,
        totals: PropTypes.array,
        totalsEditAllowed: PropTypes.bool,
        onTotalsEdit: PropTypes.func,
        config: PropTypes.object,
        data: PropTypes.shape({
            headers: PropTypes.arrayOf(PropTypes.object),
            rawData: PropTypes.arrayOf(PropTypes.array)
        }).isRequired,
        drillableItems: PropTypes.arrayOf(PropTypes.shape(DrillableItem)),
        onFiredDrillEvent: PropTypes.func,
        tableRenderer: PropTypes.func.isRequired,
        height: PropTypes.number,
        width: PropTypes.number,
        onSortChange: PropTypes.func,
        afterRender: PropTypes.func
    };

    static defaultProps = {
        afm: {},
        config: {},
        drillableItems: [],
        onFiredDrillEvent: noop,
        totals: [],
        totalsEditAllowed: false,
        onTotalsEdit: noop,
        tableRenderer: renderTable,
        afterRender: noop,
        onSortChange: noop,
        height: undefined,
        width: undefined
    };

    render() {
        const {
            data: { headers, rawData },
            config,
            height,
            width,
            onSortChange,
            afm,
            drillableItems,
            onFiredDrillEvent,
            totals,
            totalsEditAllowed,
            onTotalsEdit
        } = this.props;
        const { sortBy, sortDir } = getSortInfo(config);

        const rows = parseMetricValues(headers, rawData);

        const tableProps = {
            totals,
            totalsEditAllowed,
            onTotalsEdit,
            afm,
            rows,
            drillableItems,
            onFiredDrillEvent,
            headers,
            sortBy,
            sortDir,
            ...pick(config, ['rowsPerPage', 'onMore', 'onLess', 'sortInTooltip', 'stickyHeader']),
            onSortChange,
            afterRender: this.props.afterRender
        };

        if (height) {
            tableProps.containerHeight = height;
        }

        if (width) {
            tableProps.containerWidth = width;
        }

        return this.props.tableRenderer(tableProps);
    }
}
