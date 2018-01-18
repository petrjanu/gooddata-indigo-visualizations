import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Measure from 'react-measure';

import TableVisualization from './TableVisualization';

export default class Table extends PureComponent {
    static propTypes = {
        containerHeight: PropTypes.number,
        containerWidth: PropTypes.number
    };

    static defaultProps = {
        containerHeight: null,
        containerWidth: null
    };

    render() {
        const { containerHeight, containerWidth } = this.props;
        return (
            <Measure>
                {dimensions => (
                    <div className="viz-table-wrap" style={{ height: '100%', width: '100%' }}>
                        <TableVisualization
                            {...this.props}
                            containerHeight={containerHeight || dimensions.height}
                            containerWidth={containerWidth || dimensions.width}
                        />
                    </div>
                )}
            </Measure>
        );
    }
}
