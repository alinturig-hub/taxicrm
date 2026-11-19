import React from 'react';import {createRoot} from 'react-dom/client';
import NotificationSettings from '../../../src/components/configuration/NotificationSettings';
const mode = location.search.includes('gateway')?'gateway':'workflows';
createRoot(document.getElementById('root')!).render(<NotificationSettings mode={mode}/>);
