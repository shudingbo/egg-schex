'use strict';

const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const is = require('is-type-of');

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
	this.logger.info( 'start init schex worker ...');
};

YZSchedule.prototype.onJobEvt1 = function(evtInfo){
	if( this.jobs[evtInfo.name] === undefined && evtInfo === this.jobStep.STOP){
		return;
	}

  this.logger.info( 'schex app recv:',evtInfo.name, evtInfo.step, evtInfo.ctx );

	// run with anonymous context
	const eggctx = this.app.createAnonymousContext({
		method: 'SCHEDULE',
		url: `/__schexsdb?path=${evtInfo.name}}`,
	});


  if( this.jobs[evtInfo.name] === undefined){// create instance
		let job = evtInfo;
		if( job.parent === null || job.parent === undefined )
		{
			let pwd = getJobFunPath(job.fun);
			delete require.cache[pwd];

			let ins = require( pwd );
			job.ins = ins;
			let ctx = job.ins(eggctx, this,job, con.JobStep.INIT );
			if( ctx === undefined ){
				ctx = {};
			}

			if( Object.keys(evtInfo.ctx ).length > 0){// 在其它状态第一次运行
				job.ctx = evtInfo.ctx;
			}else{
				job.ctx = ctx;
			}
			
			job.msg = 'Init OK';
		}

    this.jobs[job.name ] = job;
  }

  switch( evtInfo.step ){
		case this.jobStep.INIT:
			{
				this.sendMsg(this.jobs[evtInfo.name],con.JobStep.INIT,null);
			}break;
		case this.jobStep.RUN:
			{
				this.onEvtRun(eggctx,evtInfo);
			}break;
		case this.jobStep.STOP:
			{
				this.onEvtStop(eggctx,evtInfo);
			}break;
  }
};

YZSchedule.prototype.onJobEvt = function(evtInfo){
	if( this.jobs[evtInfo.name] === undefined && evtInfo === this.jobStep.STOP){
		return;
	}

  this.logger.info( 'schex app recv:',evtInfo.name, evtInfo.step, evtInfo.ctx );

	// run with anonymous context
	const eggctx = this.app.createAnonymousContext({
		method: 'SCHEDULE',
		url: `/__schexsdb?path=${evtInfo.name}}`,
	});


  if( this.jobs[evtInfo.name] === undefined){// create instance
		let job = evtInfo;
		if( job.parent === null || job.parent === undefined )
		{
			let pwd = getJobFunPath(job.fun);
			delete require.cache[pwd];
			let ins = require( pwd );
			job.insIsClass = false;
			if( is.class(ins)){
				let insT = new ins( eggctx,this,job );
				job.ins = insT.onAct;
				job.insClass = insT;
				job.ins.call( job.insClass, job, con.JobStep.INIT );
			}else{
				job.ins = ins;
				job.ins(eggctx, this,job, con.JobStep.INIT );
			}

			if( Object.keys(evtInfo.ctx ).length > 0){// 在其它状态第一次运行
				job.ctx = evtInfo.ctx;
			}

			job.msg = 'Init OK';
		}

    this.jobs[job.name ] = job;
  }

  switch( evtInfo.step ){
		case this.jobStep.INIT:
			{
				this.sendMsg(this.jobs[evtInfo.name],con.JobStep.INIT,null);
			}break;
		case this.jobStep.RUN:
		case this.jobStep.STOP:
			{
					this.onEvtRunStop(eggctx,evtInfo);
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
	this.app.messenger.sendToAgent('egg-schex',info);
};

YZSchedule.prototype.onEvtRunStop = function (eggctx, evtInfo )
{
	let job = this.jobs[ evtInfo.name ];
	job.ctx = evtInfo.ctx;

	try{
		let msg = 'OK';
		if( job.insClass !== undefined ){
			msg = job.ins.call( job.insClass, job, evtInfo.step );
		}else{
			msg = job.ins(eggctx, this,job, evtInfo.step );
		}
	
		if( msg !== undefined ){
			job.msg = msg;
		}

		this.sendMsg( job, evtInfo.step, null);
		if(evtInfo.step === this.jobStep.STOP) {// 删除job;
			this.jobs[evtInfo.name] = undefined;
		}
	}catch(e){
		this.sendMsg( job, evtInfo.step,e.toString());
	}
};


/** update subJob */
YZSchedule.prototype.updateSubJob = function( name,scCfg ){
	return addSubJob( this,name, scCfg );
};


YZSchedule.prototype.removeSubJob = function( name ){
	return removeSubJob( this,name );
};


/**
 * run job
 * @param  {[type]} name job's name
 */
YZSchedule.prototype.stopJob = function( name, msg ){
	let job = this.schedules[ name ];
	if( job === undefined ){
		this.logger.info(`-- job [ ${name}] not exist;`);
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

function runJob(self, job ){

}

function stopJob( self, job ){
	if( job.status === true){
		self.logger.info( `-- [ ${job.name} ] stoping ...` );
		let msg = job.ins( self,job, con.JobStep.STOP );
		if( msg !== undefined && typeof(msg) !== 'object' ){
			job.msg = msg;
		}
	}
}


/** Add Sub Job,The child and parent to use the same function
 * 
 * 
 */
function addSubJob( self, name,scCfg ){

	if( scCfg.parent === undefined ){
		self.logger.info( '[x] no parent info' );
		return con.AddCode.Exception;
	}

  let jobParent = self.schedules[ scCfg.parent ];
	if( jobParent === undefined ){
		self.logger.info( '[x] not find parent info' );
		return con.AddCode.Exception;
	}

	if( self.schedules[ name ] === undefined )
	{
		let jobTmp = {name:name,
			  ctx: {},  // 任务上下文
				cron:scCfg.cron,
				fun :scCfg.fun,
				switch:scCfg.switch,
				status:false,
				ins : jobParent.ins,   // 函数实例
				job:null,     // jobID
				startTime:0,
				stopTime:0,
				latestRunTime:0,
				msg:'',
				parent:jobParent
			};

		self.schedules[name] = jobTmp;
		self.logger.info( `add Sub Job [ ${name} ]` );
		return con.AddCode.OK;
	}else{
		let hasChange = false;
		let thisJob = self.schedules[name];
		if( thisJob.cron !== scCfg.cron){
			thisJob.cron = scCfg.cron;
			hasChange = true;
		}

		// 记录任务当前状态 
		if( hasChange === true ){
			self.logger.info( `Change Sub Job [ ${name} ]` );
			thisJob.ctx = {};  // 清理上下文
			stopJob( self, thisJob );

			if( thisJob.status === true ){
				runJob(self, thisJob );
			}
		}
	}

	self.logger.info( `add Sub Job [ ${name} ] has exist` );
	return con.AddCode.Exist;
}

function removeSubJob( self ,name )
{
	if( self.schedules[ name ] !== undefined ){

		stopJob( self, self.schedules[ name ] );
		let parJob = self.schedules[ name ].parent;
		
		if( parJob !== undefined && parJob !== null ){
			let schs = self.schedules;
			delete schs[name];
			self.drv.removeJob( name );
		}
	}
}


//////////////
module.exports = function( opt, app ){
	return new YZSchedule( opt, app );
};
