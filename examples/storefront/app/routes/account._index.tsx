import {useOutletContext} from 'react-router';
import {CustomerLoyalty, TierProgress} from '@lunaris/easypoints-hydrogen';
import type {AccountOutletContext} from './account';

// Account landing page: a headless demonstration of the loyalty components. `<CustomerLoyalty>`
// resolves the balance + current tier, `<TierProgress>` computes advancement toward the next
// tier. Both render no markup of their own — this route owns all the JSX/formatting.
export default function AccountLoyalty() {
  const {loyalty} = useOutletContext<AccountOutletContext>();

  return (
    <div className="account-loyalty">
      <CustomerLoyalty loyalty={loyalty}>
        {({balance, tier, show}) =>
          show ? (
            <p>
              <strong>{balance?.toLocaleString()}</strong> points
              {tier ? ` · ${tier.name}` : null}
            </p>
          ) : (
            <p>No loyalty data available for this customer.</p>
          )
        }
      </CustomerLoyalty>

      <TierProgress customer={loyalty ? {loyalty} : null}>
        {({currentTier, progress, percentage}) =>
          currentTier ? (
            <div>
              <p>
                {currentTier.name} — {Math.round(percentage)}% to next tier
              </p>
              <progress value={percentage} max={100} />
              {progress?.requirement.raw ? (
                <p>
                  Requirement: {progress.requirement.raw} {progress.requirement.currency}
                </p>
              ) : null}
            </div>
          ) : null
        }
      </TierProgress>
    </div>
  );
}
