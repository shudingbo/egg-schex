'use strict';

const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const process = require('process');

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms, 'done');
  });
}

function getJobFunPath( jobFun ){
	let pwd = path.resolve(jobFun);
	if( fs.existsSync( pwd ) === true ){
		return pwd;
	}else{
		pwd = path.resolve('./node_modules/' +jobFun);
		if( fs.existsSync( pwd ) === true ){
			return jobFun;
		}
	}

	return '';
}


let YZSchedule = function( opt, app ){
	let self = this;
	this.condef = con;
	this.jobStep = con.JobStep;
	this.app = app;
	this.logger = app.getLogger('schexLogger');

	this.jobs = {};
	this.logger.info( '[shex-ap] start init schex worker ...');
};


YZSchedule.prototype.onJobEvt = function(evtInfo){
	if( this.jobs[evtInfo.name] === undefined && evtInfo === this.jobStep.STOP){
		return;
	}

	//if( evtInfo.addInfo !== undefined && evtInfo.addInfo.pid !== process.pid ){
		this.logger.debug( `[shex-ap] recv ${evtInfo.name} ${evtInfo.step}`,evtInfo.ctx );
	//}
	
	if( evtInfo.method !== undefined ){
		this.onEvtMethod( evtInfo );
		return;
	}

	// run with anonymous context
  if( this.jobs[evtInfo.name] === undefined){// create instance
		let job = evtInfo;
		if( job.parent === null )
		{
			this.initJob( evtInfo );
		}else{  // subjob Init,
			/* 1. get Parent Job Info
			   2. Init the subJob
			*/
			if( this.jobs[job.parent] === undefined ){
				this.sendMsg( job, con.JobStep.STOP, null, {
					pid: process.pid,
					method:con.Method.info
				});
				return;			
			}else{
				job.msg = 'Init OK';
				this.jobs[job.name ] = job; // 有可能是子任务初始化
			}
		}
  }

  switch( evtInfo.step ){
		case this.jobStep.INIT:
			{
				this.sendMsg(this.jobs[evtInfo.name],con.JobStep.INIT,null);
			}break;
		case this.jobStep.RUN:
		case this.jobStep.STOP:
			{
					this.onEvtRunStop(evtInfo);
			}break;
		default: break;
  }
};

YZSchedule.prototype.sendMsg = function ( job, step, err, addInfo )
{
	let info = {
		name : job.name,
		ctx : job.ctx,
		step : step,
		err  : err,
		msg  : (job.msg !== undefined) ? job.msg : '',
		addInfo : ( addInfo !== undefined ) ? addInfo : {}
	};

	if( info.addInfo.method !== undefined ){
		info.method = info.addInfo.method; 
	}

	if( job.parent !== null ){
		if( this.jobs[job.parent] !== undefined){
			info.ctx = this.jobs[ job.parent ].ctx;
		}else{
			info.ctx = {};
		}
	}
	this.app.messenger.sendToAgent('egg-schex',info);
};

YZSchedule.prototype.initJob = function ( evtInfo ){
	let job = evtInfo;
	if( job.parent === null )
	{
		let ctxTmp = Object.assign({},evtInfo.ctx);
		const eggctx = this.app.createAnonymousContext({
			method: 'SCHEDULE',
			url: `/__schexsdb?path=${evtInfo.name}}`,
		});

		let pwd = getJobFunPath(job.fun);
		delete require.cache[pwd];
		let ins = require( pwd );
		let insT = new ins( eggctx,this,job );
		job.ins = insT.onAct;
		job.insClass = insT;
		job.ins.call( job.insClass, job, con.JobStep.INIT );

		if( Object.keys(ctxTmp).length > 0){// 在其它状态第一次运行
			job.ctx = ctxTmp;
		}

		job.msg = 'Init OK';

		this.jobs[job.name ] = job; // 有可能是子任务初始化
	}
};


YZSchedule.prototype.onEvtMethod = function ( evtInfo ){
	if( evtInfo.addInfo.pid !== process.pid ){
		return;
	}

	if( evtInfo.parent !== null ){
		let p = evtInfo.parent;
		let par = {
			name: p.name,
			fun: p.fun,
			parent: null,
			cfg: p.cfg,
			step: 1,
			ctx: evtInfo.ctx
		}

		this.initJob( par );
	}

	if( evtInfo.addInfo.pid === process.pid ){
		let p = evtInfo;
		let par = {
			name: p.name,
			fun: p.fun,
			parent: evtInfo.parent.name,
			err: null,
			step: 1,
			ctx: evtInfo.ctx
		}
		this.onJobEvt( par );
	}

};


YZSchedule.prototype.onEvtRunStop = function ( evtInfo )
{
	let job = this.jobs[ evtInfo.name ];
	let actJob = job;
	if( actJob.parent !== null && actJob.parent !== undefined ){
		actJob = this.jobs[ actJob.parent ];
	}

	actJob.ctx = evtInfo.ctx;

	try{
		let msg = actJob.ins.call( actJob.insClass, job, evtInfo.step );
		if( msg !== undefined ){
			job.msg = msg;
		}

		this.sendMsg( job, evtInfo.step, null);
		if(evtInfo.step === this.jobStep.STOP) {// 删除job;
			for( let p in this.jobs ){
				if( this.jobs[p].parent === evtInfo.name ){
					this.jobs[p] = undefined;
				}
			}

			this.jobs[evtInfo.name] = undefined;
		}
	}catch(e){
		this.logger.warn(`[schex app] ${e.toString()}`);
		this.sendMsg( job, evtInfo.step,e.toString());
	}
};


/** update subJob */
YZSchedule.prototype.addSubJob = function( name,scCfg ){

	let job = this.jobs[ scCfg.parent ];
	scCfg.name = name;
	scCfg.method = this.condef.Method.add;
	this.sendMsg( job, this.jobStep.RUN, null, scCfg);
};


/**
 * Stop job
 * @param  {[type]} name job's name
 */
YZSchedule.prototype.stopJob = function( name, msg ){
	let job = this.jobs[ name ];
	if( job === undefined ){
		this.logger.info(`[shex-ap]  job [ ${name}] not exist;`);
	}else{
		if( typeof(msg) === 'string' ){
			job.msg = msg;
		}
		stopJob( this, job );
	}
};


YZSchedule.prototype.updateMsg = function( jobname, msg ){
	return this.drv.update_msg( jobname,msg );	
};


function stopJob( self, job ){
		self.sendMsg( job, con.JobStep.STOP, null, {
			method:con.Method.stop
		});
}

//////////////
module.exports = function( opt, app ){
	return new YZSchedule( opt, app );
};
