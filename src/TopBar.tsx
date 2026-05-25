import { ArrowRight, Globe2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { NodeStatusButton } from './NodeStatusButton';
import type { QdnResource } from './qdn';
import { parseQdnUrl } from './qdn';

type TopBarProps = {
  currentResource: QdnResource | null;
  onNavigate: (resource: QdnResource) => void;
};

export function TopBar({ currentResource, onNavigate }: TopBarProps) {
  const [addressValue, setAddressValue] = useState('');
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (currentResource) {
      setAddressValue(currentResource.displayUrl);
    }
  }, [currentResource]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUrl = parseQdnUrl(addressValue);

    if (!parsedUrl.success) {
      setAddressError(parsedUrl.message);
      return;
    }

    setAddressError('');
    onNavigate(parsedUrl.resource);
  }

  return (
    <header className="top-bar">
      <form className="top-bar__address-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="qdn-address">
          QDN address
        </label>
        <div className="top-bar__address-control">
          <Globe2 aria-hidden="true" className="top-bar__address-icon" size={20} strokeWidth={2} />
          <input
            autoComplete="off"
            className="top-bar__address-input"
            id="qdn-address"
            placeholder="qdn://WEBSITE/QortiumHomeTest/default/"
            spellCheck={false}
            type="text"
            value={addressValue}
            onChange={(event) => {
              setAddressValue(event.target.value);
              setAddressError('');
            }}
          />
        </div>
        <button className="icon-button top-bar__go-button" title="Load QDN address" type="submit">
          <ArrowRight aria-hidden="true" size={20} strokeWidth={2} />
          <span className="sr-only">Load QDN address</span>
        </button>
        {addressError ? <p className="top-bar__error">{addressError}</p> : null}
      </form>
      <NodeStatusButton />
    </header>
  );
}
