import mongoose from 'mongoose'

const connectDB = async () => {
    const url = 'mongodb://tomat:tomat@100.104.189.99:27017/?authSource=admin'
    try {
        await mongoose.connect(url, {
            dbName: 'absenlembur_gardira'
        })
        return Promise.resolve('Dtabase Connect')
    } catch (error) {
     return Promise.reject(error)   
    }
}

export default connectDB