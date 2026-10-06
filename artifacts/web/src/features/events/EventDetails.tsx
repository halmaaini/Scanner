import { updateEvent, type Event } from "@workspace/api-client-react";
import { MAX_MAP_URL_LENGTH, MAX_VENUE_LENGTH } from "@workspace/attendance";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { buttonStyles } from "@/components/buttonStyles";
import { isNetworkError, statusOf } from "@/lib/errors";
import { fromDateTimeInput, toDateTimeInput } from "@/lib/format";
import { patchRoster } from "@/lib/rosterCache";
import { m } from "@/messages";

/** When and where an event is, as attendees see it on their card. Super admin only; needs a connection. */
export function EventDetails({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(toDateTimeInput(event.startsAt));
  const [venue, setVenue] = useState(event.venue ?? "");
  const [mapUrl, setMapUrl] = useState(event.mapUrl ?? "");
  const [hasSeating, setHasSeating] = useState(event.hasSeating ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(submit: FormEvent) {
    submit.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateEvent(event.id, {
        startsAt: fromDateTimeInput(startsAt),
        venue,
        mapUrl,
        hasSeating,
      });
      await patchRoster((roster) => ({
        ...roster,
        events: roster.events.map((e) => (e.id === updated.id ? updated : e)),
      }));
      setMessage(m.events.saved);
    } catch (error) {
      setMessage(
        statusOf(error) === 400
          ? m.events.invalidLink
          : statusOf(error) === 403
            ? m.events.forbidden
            : isNetworkError(error)
              ? m.events.needsConnection
              : m.events.failed,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={m.events.detailsFor(event.name)}
        className={`${buttonStyles.link} self-start`}
        onClick={() => setOpen(true)}
      >
        {m.events.details}
      </button>
    );
  }

  return (
    <form
      onSubmit={(submit) => void save(submit)}
      className="flex flex-col gap-3 border-t border-rule pt-3"
    >
      <Field
        label={m.events.startsAt}
        type="datetime-local"
        value={startsAt}
        onChange={(e) => setStartsAt(e.target.value)}
      />
      <Field
        label={m.events.venue}
        value={venue}
        maxLength={MAX_VENUE_LENGTH}
        onChange={(e) => setVenue(e.target.value)}
      />
      <Field
        label={m.events.mapUrl}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={mapUrl}
        maxLength={MAX_MAP_URL_LENGTH}
        onChange={(e) => setMapUrl(e.target.value)}
      />
      <p className="text-sm text-muted">{m.events.mapHint}</p>
      <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
        <input
          type="checkbox"
          checked={hasSeating}
          onChange={(e) => setHasSeating(e.target.checked)}
          className="size-5 accent-ink"
        />
        {m.events.hasSeating}
      </label>
      {message && (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      )}
      <Button type="submit" busy={saving}>
        {m.events.save}
      </Button>
    </form>
  );
}
