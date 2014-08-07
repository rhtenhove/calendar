/**
 * ownCloud - Calendar App
 *
 * @author Raghu Nayyar
 * @author Georg Ehrke
 * @copyright 2014 Raghu Nayyar <beingminimal@gmail.com>
 * @copyright 2014 Georg Ehrke <oc.list@georgehrke.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


app.factory('EventsModel', function () {
	var EventsModel = function () {
		this.events = [];
		this.eventsUid = {};
		this.eventobject = {};
		this.calid = {
			id: '',
			changer: ''
		}; // required for switching the calendars on the fullcalendar
		this.components = {};
		this.vevents = {};
		this.eventsmodalproperties = {
			"event": '',
			"jsEvent": '',
			"view": ''
		};
	};


	/**
	 * check if vevent is the one described in event
	 * @param {Object} event
	 * @param {Object} vevent
	 * @returns {boolean}
	 */
	function isCorrectEvent(event, vevent) {
		if (event.objectUri !== vevent.getFirstPropertyValue('x-oc-uri')) {
			return false;
		}

		if (event.recurrenceId === null) {
			if (!vevent.hasProperty('recurrence-id')) {
				return true;
			}
		} else {
			if (event.recurrenceId === vevent.getFirstPropertyValue('recurrence-id').toICALString()) {
				return true;
			}
		}

		return false;
	}


	EventsModel.prototype = {
		create: function (newevent) {
			var rawdata = new ICAL.Event();
			this.events.push(rawdata);
		},
		addAllDisplayFigures: function (calendarId, jcalData, start, end, timezone) {
			var components = new ICAL.Component(jcalData);
			var events = [];

			var dtstart = '';
			var dtend = '';
			var etag = '';
			var eventsId = '';
			var uri = '';
			var recurrenceId = null;
			var isAllDay = false;

			if (components.jCal.length !== 0) {
				var vtimezones = components.getAllSubcomponents("vtimezone");
				angular.forEach(vtimezones, function (vtimezone) {
					var timezone = new ICAL.Timezone(vtimezone);
					ICAL.TimezoneService.register(timezone.tzid, timezone);
				});

				var vevents = components.getAllSubcomponents("vevent");
				angular.forEach(vevents, function (vevent) {
					// Todo : Repeating Calendar.
					if (vevent.hasProperty('dtstart')) {
						uri = vevent.getFirstPropertyValue('x-oc-uri');
						etag = vevent.getFirstPropertyValue('x-oc-etag');

						if (!vevent.hasProperty('dtstart')) {
							return;
						}
						dtstart = vevent.getFirstPropertyValue('dtstart');

						if (vevent.hasProperty('recurrence-id')) {
							recurrenceId = vevent.getFirstPropertyValue('recurrence-id').toICALString();
						}

						if (vevent.hasProperty('dtend')) {
							dtend = vevent.getFirstPropertyValue('dtend');
						} else if (vevent.hasProperty('duration')) {
							dtend = dtstart.clone();
							dtend.addDuration(vevent.getFirstPropertyValue('dtstart'));
						} else {
							dtend = dtstart.clone();
						}

						if (dtstart.icaltype != 'date' && dtstart.zone != ICAL.Timezone.utcTimezone && dtstart.zone != ICAL.Timezone.localTimezone) {
							dtstart = dtstart.convertToZone(timezone);
						}

						if (dtend.icaltype != 'date' && dtend.zone != ICAL.Timezone.utcTimezone && dtend.zone != ICAL.Timezone.localTimezone) {
							dtend = dtend.convertToZone(timezone);
						}

						isAllDay = (dtstart.icaltype == 'date' && dtend.icaltype == 'date');

						eventsId = uri;
						if (recurrenceId !== null) {
							eventsId = eventsId + recurrenceId;
						}

						events.push({
							"id": eventsId,
							"calendarId": calendarId,
							"objectUri": uri,
							"etag": etag,
							"recurrenceId": recurrenceId,
							"title": vevent.getFirstPropertyValue('summary'),
							"start": dtstart.toJSDate(),
							"end": dtend.toJSDate(),
							"allDay": isAllDay
						});
					}
				});
			}
			return events;
		},
		eventResizer: function (event, delta, jcalData) {
			var components = new ICAL.Component(jcalData);
			var vevents = components.getAllSubcomponents('vevent');
			var didFindEvent = false;
			var deltaAsSeconds = 0;
			var duration = null;
			var propertyToUpdate = null;

			components.removeAllSubcomponents('vevent');

			if (components.jCal.length !== 0) {
				for (var i = 0; i < vevents.length; i++) {
					if (!isCorrectEvent(event, vevents[i])) {
						components.addSubcomponent(vevents[i]);
						continue;
					}

					deltaAsSeconds = delta.asSeconds();
					duration = new ICAL.Duration().fromSeconds(deltaAsSeconds);

					if (vevents[i].hasProperty('duration')) {
						propertyToUpdate = vevents[i].getFirstPropertyValue('duration');
						duration.fromSeconds((duration.toSeconds() + propertyToUpdate.toSeconds()));
						vevents[i].updatePropertyWithValue('duration', duration);
					} else if (vevents[i].hasProperty('dtend')) {
						propertyToUpdate = vevents[i].getFirstPropertyValue('dtend');
						propertyToUpdate.addDuration(duration);
						vevents[i].updatePropertyWithValue('dtend', propertyToUpdate);
					} else if (vevents[i].hasProperty('dtstart')) {
						propertyToUpdate = vevents[i].getFirstPropertyValue('dtstart').clone();
						propertyToUpdate.addDuration(duration);
						vevents[i].addPropertyWithValue('dtend', propertyToUpdate);
					} else {
						continue;
					}

					components.addSubcomponent(vevents[i]);
					didFindEvent = true;
				}
			}

			return (didFindEvent) ? components.toString() : null;
		},
		eventDropper: function (event, delta, jcalData) {
			var components = new ICAL.Component(jcalData);
			var vevents = components.getAllSubcomponents('vevent');
			var didFindEvent = false;
			var deltaAsSeconds = 0;
			var duration = null;
			var propertyToUpdate = null;

			components.removeAllSubcomponents('vevent');

			if (components.jCal.length !== 0) {
				for (var i = 0; i < vevents.length; i++) {
					if (!isCorrectEvent(event, vevents[i])) {
						components.addSubcomponent(vevents[i]);
						continue;
					}

					deltaAsSeconds = delta.asSeconds();
					duration = new ICAL.Duration().fromSeconds(deltaAsSeconds);

					if (vevents[i].hasProperty('dtstart')) {
						propertyToUpdate = vevents[i].getFirstPropertyValue('dtstart');
						propertyToUpdate.addDuration(duration);
						vevents[i].updatePropertyWithValue('dtstart', propertyToUpdate);

					}

					if (vevents[i].hasProperty('dtend')) {
						propertyToUpdate = vevents[i].getFirstPropertyValue('dtend');
						propertyToUpdate.addDuration(duration);
						vevents[i].updatePropertyWithValue('dtend', propertyToUpdate);
					}

					components.addSubcomponent(vevents[i]);
					didFindEvent = true;
				}
			}

			return (didFindEvent) ? components.toString() : null;
		},
		modalpropertyholder: function (event, jsEvent, view, jcalData) {
			this.components = new ICAL.Component(jcalData);
			this.vevents = this.components.getAllSubcomponents('vevent');
			if (this.components.jCal.length !== 0) {
				for (var i = 0; i < this.vevents.length; i++) {
					if (!isCorrectEvent(event, this.vevents[i])) {
						this.components.addSubcomponent(vevents[i]);
						continue;
					}
					this.eventobject = {
						"title" : this.vevents[i].getFirstPropertyValue('summary'),
						"location" : this.vevents[i].getFirstPropertyValue('location'),
						"categoties" : this.vevents[i].getFirstPropertyValue('category'),
						"description" : this.vevents[i].getFirstPropertyValue('description')
					};
				}
			}
		},
		addattendee: function (attendee) {
			this.components.removeAllSubcomponents('vevent');

			if (this.components.jCal.length !== 0) {
				for (var i = 0; i < this.vevents.length; i++) {
					console.log(this.vevents[i]);
					console.log(attendee);
					//if (!isCorrectEvent(event, this.vevents[i])) {
					//	this.components.addSubcomponent(this.vevents[i]);
					//	continue;
					//}

					var property = new ICAL.Property('attendee');

					property.setParameter('ROLE', 'REQ-PARTICIPANT');
					property.setParameter('RVSP', true);
					property.setParameter('PARTSTAT', 'NEEDS-ACTION');
					property.setParameter('CUTYPE', 'INDIVIDUAL');
					property.setParameter('X-OC-SENTMAIL', false);

					property.setValue('email addr');

					console.log(property.toJSON());
				}
			}
		},
		updateevent : function (updated) {
			console.log(updated);
		},
		addEvent: function (id) {
			this.calid.changer = Math.random(1000);
			this.calid.id = id;
		},
		getAll: function () {
			return this.events;
		},
		remove: function (id) {
			delete this.id;
		}
	};

	return new EventsModel();
});