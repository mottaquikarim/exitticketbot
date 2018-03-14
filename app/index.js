// npm modules
const Airtable = require('airtable');
const moment = require('moment');
const request = require('superagent');

const generatePayload = (conf, data) => {
    const {users,template,mentionSep} = conf;
    const mentions = users.map(user => `<@${user}>`).join(mentionSep || ' or ');
    const tform = template
        .replace(/\\n/g, '\n')
        .replace(/\$DATA/g, data)
        .replace(/\$MENTIONS/g, mentions);
    return tform;
}

// make call to slack
const postToSlack = (webhook=null, payload={}) => new Promise((resolve, reject) => request
    .post(webhook)
    .send(payload)
    .end((err, res) => {
        if (err) reject(err)
        else resolve(res)
    }));

const determineRunnable = days => {
    const now = moment().subtract(5, 'hours');
    return days.reduce((bool, day) => {
        if (bool) return true;
        if (now.format('dddd').toLowerCase() === day) bool = true;
        return bool;
    }, false);
}

// webtask context execution
const runTask = (context, cb) => {
    const SLACK_PAYLOAD = {
        text: context.secrets.TEXT,
        mrkdwn: true,
        attachments: [{
            title: context.secrets.TITLE,
            title_link: context.secrets.TITLE_LINK,
            text: context.secrets.TITLE_TEXT,
        }]
    }
    if (!determineRunnable((context.secrets.BOT_DAY || "").split(','))) {
        cb(null, {e: `${moment().format('dddd')} is not a runnable day`})
        return;
    }
    postToSlack(context.secrets.SLACK_WEBHOOK, SLACK_PAYLOAD)
        .then(resp => {
            cb(null, resp);
        })
        .catch(e => {
            console.log(e)
            cb(null, { err: e });
        });
}

// gross but necessary evil because webtask seems to
// not support linking to local dependencies...
const exportables = {
    runTask,
    postToSlack,
};

if (process.env.TRAVIS_TEST_ENV) {
    module.exports = exportables;
}
else {
    module.exports = runTask;
}
