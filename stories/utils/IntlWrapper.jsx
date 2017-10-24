import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { IntlProvider } from 'react-intl';

import translations from '../../mock-translations/en';

export default class IntlWrap extends PureComponent {
    static propTypes = {
        children: PropTypes.node.isRequired
    };

    render() {
        return (
            <IntlProvider
                locale="en"
                messages={translations}
            >
                {this.props.children}
            </IntlProvider>
        );
    }
}
