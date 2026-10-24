import { useHookstate } from '@hookstate/core';
import React from 'react';
import { NavLink } from 'react-router-dom';
import { TOOLTIPS_READY, enableTooltips } from '../../renderer/state/priceList';

export function Nav() {
  const tooltipsReadyHook = useHookstate(TOOLTIPS_READY);
  const tooltipsReady = tooltipsReadyHook.get();
  
  return (
    <nav className="space-x-4">
      <NavLink to="/" className={({ isActive }) => isActive ? 'bg-blue-600 text-white px-3 py-1 inline-block font-semibold rounded border-2 border-blue-600' : 'text-blue-600 px-3 py-1 inline-block font-semibold rounded border-2 border-blue-600'}>Home</NavLink>
      {tooltipsReady === false &&
        <button onClick={enableTooltips} className='bg-blue-600 text-white px-3 py-1 inline-block font-semibold rounded border-2 border-blue-600'>
          Enable Tooltips
        </button>
      }

      {tooltipsReady === 'loading' &&
        <button className='bg-blue-600 text-white px-3 py-1 inline-block font-semibold rounded border-2 border-blue-600'>
          Initializing
        </button>
      }

      {tooltipsReady === true &&
        <button className='bg-blue-600 text-white px-3 py-1 inline-block font-semibold rounded border-2 border-blue-600'>
          Tooltips Enabled
        </button>
      }
    </nav>
  )
}