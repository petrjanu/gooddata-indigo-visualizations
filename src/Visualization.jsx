// (C) 2007-2018 GoodData Corporation
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import invariant from 'invariant';
import { isEqual, isFunction, omitBy } from 'lodash';
import Highcharts from 'highcharts';

import TableTransformation from './table/TableTransformation';

import {
    isTable,
    isChartSupported,
    stringifyChartTypes
} from './utils/common';

export default class Visualization extends Component {
    static propTypes = {
        config: PropTypes.shape({
            type: PropTypes.string.isRequired
        }).isRequired,
        onFiredDrillEvent: PropTypes.func,
        numericSymbols: PropTypes.array,
        afterRender: PropTypes.func
    };

    static defaultProps = {
        numericSymbols: [],
        onFiredDrillEvent: () => {},
        afterRender: () => {}
    };

    constructor(props) {
        super(props);

        this.setNumericSymbols(this.props);
    }

    componentWillReceiveProps(nextProps) {
        this.setNumericSymbols(nextProps);
    }

    shouldComponentUpdate(nextProps) {
        return !isEqual(omitBy(this.props, isFunction), omitBy(nextProps, isFunction));
    }

    setNumericSymbols(props = {}) {
        const { numericSymbols } = props;

        if (numericSymbols && numericSymbols.length) {
            Highcharts.setOptions({
                lang: {
                    numericSymbols
                }
            });
        }
    }

    render() {
        const visType = this.props.config.type;

        if (isTable(visType)) {
            return (
                <TableTransformation {...this.props} />
            );
        }

        if (isChartSupported(visType)) {
            invariant(false, 'Charts are moved to @gooddata/react-components');
            return false;
        }

        return invariant(isChartSupported(visType), `Unknown visualization type: ${visType}. Supported visualization types: ${stringifyChartTypes()}`);
    }
}
