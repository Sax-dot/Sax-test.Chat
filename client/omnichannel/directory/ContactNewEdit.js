import React, { useState, useMemo } from 'react';
import { Field, TextInput, Icon, ButtonGroup, Button, Box } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';


import { useTranslation } from '../../contexts/TranslationContext';
import VerticalBar from '../../components/basic/VerticalBar';
import { useForm } from '../../hooks/useForm';
import { isEmail } from '../../../app/utils';
import { useComponentDidUpdate } from '../../hooks/useComponentDidUpdate';
import { useEndpointAction } from '../../hooks/useEndpointAction';
import { useToastMessageDispatch } from '../../contexts/ToastMessagesContext';
import { useEndpointDataExperimental, ENDPOINT_STATES } from '../../hooks/useEndpointDataExperimental';
import { FormSkeleton } from './Skeleton';
import CustomFieldsForm from '../../components/CustomFieldsForm';
import { hasAtLeastOnePermission } from '../../../app/authorization';


const initialValues = {
	name: '',
	email: '',
	phone: '',
};

const getInitialValues = (data) => {
	if (!data) {
		return initialValues;
	}

	const { contact } = data;
	const { name, phone, visitorEmails, livechatData } = contact;

	return {
		name: name ?? '',
		email: visitorEmails ? visitorEmails[0].address : '',
		phone: phone ? phone[0].phoneNumber : '',
		livechatData: livechatData ?? '',
	};
};

export function ContactEditWithData({ id, reload, close }) {
	const t = useTranslation();
	const { data, state, error } = useEndpointDataExperimental(`contact?contactId=${ id }`);

	if ([state].includes(ENDPOINT_STATES.LOADING)) {
		return <FormSkeleton/>;
	}

	if (error || !data || !data.contact) {
		return <Box mbs='x16'>{t('Contact_not_found')}</Box>;
	}

	return <ContactNewEdit id={id} data={data} reload={reload} close={close} />;
}

export function ContactNewEdit({ id, data, reload, close }) {
	const t = useTranslation();

	const canViewCustomFields = () => hasAtLeastOnePermission(['view-livechat-room-customfields', 'edit-livechat-room-customfields']);

	const { values, handlers } = useForm(getInitialValues(data));

	const {
		handleName,
		handleEmail,
		handlePhone,
	} = handlers;
	const {
		name,
		email,
		phone,
	} = values;

	const { values: valueCustom, handlers: handleValueCustom } = useForm({
		livechatData: values.livechatData,
	});

	const { handleLivechatData } = handleValueCustom;
	const { livechatData } = valueCustom;

	const [nameError, setNameError] = useState();
	const [emailError, setEmailError] = useState();
	const [phoneError] = useState();

	const { data: allCustomFields, state } = useEndpointDataExperimental('livechat/custom-fields');

	const jsonConverterToValidFormat = (customFields) => {
		const jsonObj = {};
		// eslint-disable-next-line no-return-assign
		customFields.map(({ _id, visibility, options, scope, defaultValue, required }) =>
			(visibility === 'visible' & scope === 'visitor')
			&& (jsonObj[_id] = {
				type: options ? 'select' : 'text',
				required,
				defaultValue,
				options: options && options.split(',').map((item) => item.trim()),
			}));
		return jsonObj;
	};

	const jsonCustomField = useMemo(() => (allCustomFields
		&& allCustomFields.customFields
		? jsonConverterToValidFormat(allCustomFields.customFields) : {}), [allCustomFields]);

	const saveContact = useEndpointAction('POST', 'contact');

	const dispatchToastMessage = useToastMessageDispatch();

	useComponentDidUpdate(() => {
		setNameError(!name ? t('The_field_is_required', t('Name')) : '');
	}, [t, name]);
	useComponentDidUpdate(() => {
		setEmailError(!isEmail(email) ? t('Validate_email_address') : '');
	}, [t, email]);

	const handleSave = useMutableCallback(async (e) => {
		e.preventDefault();
		let error = false;
		if (!name) {
			setNameError(t('The_field_is_required', 'name'));
			error = true;
		}
		if (email && !isEmail(email)) {
			setEmailError(t('Validate_email_address'));
			error = true;
		}

		if (error) {
			return;
		}

		const payload = {
			name,
			email,
			phone,
		};

		if (id) { payload._id = id; }
		if (livechatData) { payload.livechatData = livechatData; }

		try {
			await saveContact(payload);
			dispatchToastMessage({ type: 'success', message: t('Saved') });
			reload();
			close();
		} catch (error) {
			dispatchToastMessage({ type: 'error', message: error });
		}
	});

	const formIsValid = name;

	if ([state].includes(ENDPOINT_STATES.LOADING)) {
		return <FormSkeleton/>;
	}

	return <>
		<VerticalBar.ScrollableContent is='form'>
			<Field>
				<Field.Label>{t('Name')}</Field.Label>
				<Field.Row>
					<TextInput error={nameError} flexGrow={1} value={name} onChange={handleName} placeholder={t('Insert_Contact_Name')} />
				</Field.Row>
				<Field.Error>
					{nameError}
				</Field.Error>
			</Field>
			<Field>
				<Field.Label>{t('Email')}</Field.Label>
				<Field.Row>
					<TextInput error={emailError} flexGrow={1} value={email} onChange={handleEmail} placeholder='example@domain.com' addon={<Icon name='mail' size='x20'/>}/>
				</Field.Row>
				<Field.Error>
					{t(emailError)}
				</Field.Error>
			</Field>
			<Field>
				<Field.Label>{t('Phone')}</Field.Label>
				<Field.Row>
					<TextInput error={phoneError} flexGrow={1} value={phone} onChange={handlePhone} />
				</Field.Row>
				<Field.Error>
					{t(phoneError)}
				</Field.Error>
			</Field>
			{ canViewCustomFields() && allCustomFields
			&& <CustomFieldsForm jsonCustomFields={jsonCustomField} customFieldsData={livechatData} setCustomFieldsData={handleLivechatData} /> }
		</VerticalBar.ScrollableContent>
		<VerticalBar.Footer>
			<ButtonGroup stretch>
				<Button flexGrow={1} type='reset'>{t('Cancel')}</Button>
				<Button mie='none' flexGrow={1} onClick={handleSave} disabled={!formIsValid} primary>{t('Save')}</Button>
			</ButtonGroup>
		</VerticalBar.Footer>
	</>;
}