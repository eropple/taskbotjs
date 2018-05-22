import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";

TimeAgo.locale(en)
const timeAgo = new TimeAgo("en-us");

export function formatToRelativeTime(datetime) {
  return timeAgo.format(datetime.toJSDate());
}

export function formatToDate(datetime) {
  return datetime.toFormat("fff");
}

export function formatToFullDate(datetime) {
  return `${formatToRelativeTime(datetime)} (${formatToDate(datetime)})`;
}
